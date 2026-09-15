import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b),
    m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export function qualifyOpponentPerformances(
  games: HistoricalPlayerGame[],
  position: 'QB' | 'RB' | 'WR' | 'TE',
) {
  const grouped = new Map<string, HistoricalPlayerGame[]>();
  for (const game of games) grouped.set(game.gameId, [...(grouped.get(game.gameId) ?? []), game]);
  const result: HistoricalPlayerGame[] = [];
  for (const rows of grouped.values()) {
    if (position === 'QB') {
      const leader = [...rows].sort(
        (a, b) => (b.passingAttempts ?? 0) - (a.passingAttempts ?? 0),
      )[0];
      if (leader && ((leader.passingAttempts ?? 0) >= 15 || (leader.passingAttempts ?? 0) > 0))
        result.push(leader);
    } else if (position === 'RB') {
      const leader = [...rows].sort((a, b) => (b.carries ?? 0) - (a.carries ?? 0))[0];
      if (leader && (leader.carries ?? 0) >= 8) result.push(leader);
    } else result.push(...rows.filter((row) => (row.targets ?? 0) >= (position === 'WR' ? 3 : 2)));
  }
  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
export function calculateOpponentVsPosition(
  games: HistoricalPlayerGame[],
  position: 'QB' | 'RB' | 'WR' | 'TE',
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
) {
  const qualified = qualifyOpponentPerformances(games, position),
    values = qualified
      .map((game) => ({ game, value: resolveHistoricalStat(game, statType) }))
      .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null);
  const summarize = (rows: typeof values) => {
    const nums = rows.map((r) => r.value),
      hits = nums.filter((v) => didHit(v, line, side)).length;
    return {
      games: nums.length,
      hits,
      hitRate: nums.length ? Math.round((hits / nums.length) * 1000) / 10 : null,
      average: nums.length
        ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
        : null,
      median: median(nums),
    };
  };
  const latest = Math.max(...qualified.map((g) => g.season), 0);
  return {
    position,
    label: position === 'RB' ? 'Lead backs' : `${position}s`,
    qualification:
      position === 'QB'
        ? 'One primary QB per game'
        : position === 'RB'
          ? 'Lead back with at least 8 carries'
          : `${position}s with at least ${position === 'WR' ? 3 : 2} targets`,
    last5: summarize(values.slice(0, 5)),
    last10: summarize(values.slice(0, 10)),
    season: summarize(values.filter((r) => r.game.season === latest)),
    last2Years: summarize(values),
    sampleConfidence: values.length >= 8 ? 'HIGH' : values.length >= 5 ? 'MEDIUM' : 'LOW',
    recentResults: values
      .slice(0, 10)
      .reverse()
      .map(({ game, value }) => ({
        gameId: game.gameId,
        week: game.week,
        opponent: game.teamId,
        value,
        result: didHit(value, line, side) ? 'HIT' : 'MISS',
      })),
  };
}
