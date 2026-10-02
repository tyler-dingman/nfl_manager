import type { PlayerRowDTO } from '@/types/player';
import type { FranchiseSimulationState, SimulatedPlayerStat } from '@/types/front-office';

export type DevelopmentTrend = { direction: -1 | 0 | 1; reason: string };
const overall = (p: PlayerRowDTO) => p.rating ?? p.maddenRating ?? p.baselineRating ?? 0;
const starterSlots: Record<string, number> = {
  WR: 3,
  CB: 3,
  LB: 3,
  DE: 2,
  DT: 2,
  EDGE: 2,
  S: 2,
  G: 2,
  OT: 2,
};
function performance(s: SimulatedPlayerStat) {
  if ((s.rushingYards ?? 0) >= 75) return `${s.rushingYards} rushing yards`;
  if ((s.receivingYards ?? 0) >= 75) return `${s.receivingYards} receiving yards`;
  if ((s.passingYards ?? 0) >= 250 && (s.interceptions ?? 0) <= 1)
    return `${s.passingYards} passing yards`;
  if ((s.rushingTD ?? 0) + (s.receivingTD ?? 0) > 0) return 'Scored a touchdown';
  if ((s.passingTD ?? 0) >= 2 && (s.interceptions ?? 0) <= 1)
    return `${s.passingTD} passing touchdowns`;
  if ((s.sacks ?? 0) >= 1) return `${s.sacks} sacks`;
  if ((s.defensiveInterceptions ?? 0) > 0) return 'Recorded an interception';
  if ((s.tackles ?? 0) >= 8) return `${s.tackles} tackles`;
  return null;
}
/** Weekly momentum is separate from imported OVR/baseline differences. */
export function playerDevelopmentTrends(
  roster: PlayerRowDTO[],
  state: FranchiseSimulationState | null | undefined,
  team: string,
) {
  const active = roster.filter(
    (p) => p.status?.toLowerCase() !== 'cut' && (!p.teamAbbr || p.teamAbbr === team),
  );
  const result = new Map<string, DevelopmentTrend>(
    active.map((p) => [p.id, { direction: 0, reason: 'Stable development outlook' }]),
  );
  const depth = new Map<string, number>();
  for (const position of new Set(active.map((p) => p.position))) {
    active
      .filter((p) => p.position === position)
      .sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
      .forEach((p, i) => depth.set(p.id, i + 1));
  }
  const games =
    state?.games
      .filter((g) => g.played && (g.homeTeam === team || g.awayTeam === team))
      .sort((a, b) => b.week - a.week) ?? [];
  if (!games.length && (!state || state.currentWeek === 0)) {
    active
      .filter((p) => (p.age ?? 100) <= 27)
      .sort(
        (a, b) =>
          (depth.get(a.id) ?? 99) - (depth.get(b.id) ?? 99) ||
          overall(b) - overall(a) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 3)
      .forEach((p) =>
        result.set(p.id, {
          direction: 1,
          reason: 'Week 1 outlook: young player with a strong depth-chart opportunity',
        }),
      );
  } else if (games[0]) {
    for (const stat of games[0].result?.playerStats ?? []) {
      const reason = performance(stat);
      if (reason && result.has(stat.playerId))
        result.set(stat.playerId, { direction: 1, reason: `Latest game: ${reason}` });
    }
  }
  active
    .filter(
      (p) =>
        (p.age ?? 0) >= 30 &&
        (depth.get(p.id) ?? 1) > (starterSlots[p.position] ?? 1) &&
        result.get(p.id)?.direction !== 1,
    )
    .sort(
      (a, b) =>
        (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0) ||
        (b.age ?? 0) - (a.age ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 2)
    .forEach((p) =>
      result.set(p.id, {
        direction: -1,
        reason: `Age ${p.age}; No. ${depth.get(p.id)} at ${p.position}, behind the starting group`,
      }),
    );
  return result;
}
