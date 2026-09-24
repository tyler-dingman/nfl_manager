import type { FranchiseGameState, SimulatedPlayerStat } from '@/types/front-office';

const fields = [
  ['completions', 'Completions'],
  ['attempts', 'Pass attempts'],
  ['passingYards', 'Passing yards'],
  ['passingTD', 'Passing TDs'],
  ['interceptions', 'Interceptions thrown'],
  ['carries', 'Carries'],
  ['rushingYards', 'Rushing yards'],
  ['rushingTD', 'Rushing TDs'],
  ['receptions', 'Receptions'],
  ['receivingYards', 'Receiving yards'],
  ['receivingTD', 'Receiving TDs'],
  ['tackles', 'Tackles'],
  ['sacks', 'Sacks'],
  ['defensiveInterceptions', 'Defensive interceptions'],
  ['forcedFumbles', 'Forced fumbles'],
] as const satisfies ReadonlyArray<readonly [keyof SimulatedPlayerStat, string]>;

/** Use recorded box scores only: missing lines are not zero-stat appearances. */
export function summarizeSimulatedPlayerStats(games: FranchiseGameState[], playerId: string) {
  const seen = new Set<string>();
  const lines: SimulatedPlayerStat[] = [];
  for (const game of games) {
    if (!game.played || seen.has(game.id)) continue;
    seen.add(game.id);
    const line = game.result?.playerStats?.find((stat) => stat.playerId === playerId);
    if (line) lines.push(line);
  }
  return {
    recordedGames: lines.length,
    stats: fields.flatMap(([key, label]) => {
      const values = lines
        .map((line) => line[key])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return values.length
        ? [
            {
              label,
              value: values
                .reduce((sum, value) => sum + value, 0)
                .toLocaleString('en-US', { maximumFractionDigits: 1 }),
            },
          ]
        : [];
    }),
  };
}
