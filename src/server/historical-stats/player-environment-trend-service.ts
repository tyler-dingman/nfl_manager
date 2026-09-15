import { deriveHistoricalGameContext, type GameEnvironment } from './game-environment-service';
import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

export type EnvironmentSplit = {
  games: number;
  hits: number;
  hitRate: number | null;
  average: number | null;
  median: number | null;
  averageMargin: number | null;
  sampleConfidence: 'Very limited' | 'Limited' | 'Medium' | 'Stronger sample';
};
type Evaluated = { value: number; hit: boolean; margin: number; context: GameEnvironment };
const rounded = (value: number) => Math.round(value * 10) / 10;
const summarize = (rows: Evaluated[]): EnvironmentSplit => {
  const values = rows.map((row) => row.value).sort((a, b) => a - b),
    games = rows.length,
    hits = rows.filter((row) => row.hit).length,
    median = games
      ? games % 2
        ? values[Math.floor(games / 2)]!
        : (values[games / 2 - 1]! + values[games / 2]!) / 2
      : null;
  return {
    games,
    hits,
    hitRate: games ? rounded((hits / games) * 100) : null,
    average: games ? rounded(values.reduce((sum, value) => sum + value, 0) / games) : null,
    median: median === null ? null : rounded(median),
    averageMargin: games ? rounded(rows.reduce((sum, row) => sum + row.margin, 0) / games) : null,
    sampleConfidence:
      games <= 2
        ? 'Very limited'
        : games <= 4
          ? 'Limited'
          : games <= 9
            ? 'Medium'
            : 'Stronger sample',
  };
};
export function calculatePlayerEnvironmentTrends(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
) {
  const rows: Evaluated[] = games.flatMap((game) => {
    const value = resolveHistoricalStat(game, statType);
    if (value === null || !game.kickoffAt) return [];
    return [
      {
        value,
        hit: didHit(value, line, side),
        margin: side === 'UNDER' ? line - value : value - line,
        context: deriveHistoricalGameContext(game),
      },
    ];
  });
  const split = (test: (context: GameEnvironment) => boolean) =>
    summarize(rows.filter((row) => test(row.context)));
  return {
    overall: summarize(rows),
    day: split((c) => c.isDayGame),
    night: split((c) => c.isNightGame),
    primetime: split((c) => c.isPrimetime),
    thursdayNight: split((c) => c.primetimeType === 'TNF'),
    sundayNight: split((c) => c.primetimeType === 'SNF'),
    mondayNight: split((c) => c.primetimeType === 'MNF'),
    sundayEarly: split((c) => c.gameWindow === 'SUNDAY_EARLY'),
    sundayLate: split((c) => c.gameWindow === 'SUNDAY_LATE'),
    shortRest: split((c) => c.restBucket === 'SHORT_REST'),
    normalRest: split((c) => c.restBucket === 'NORMAL_REST'),
    extendedRest: split((c) => c.restBucket === 'EXTENDED_REST'),
  };
}
