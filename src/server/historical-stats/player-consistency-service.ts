import { resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

const round = (value: number) => Math.round(value * 10) / 10;
const quantile = (sorted: number[], value: number) => {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * value,
    lower = Math.floor(position),
    fraction = position - lower;
  return (
    sorted[lower]! +
    (sorted[lower + 1] === undefined ? 0 : fraction * (sorted[lower + 1]! - sorted[lower]!))
  );
};
export function calculatePlayerConsistency(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
) {
  const values = games
    .map((game) => ({ date: game.date, value: resolveHistoricalStat(game, statType) }))
    .filter((row): row is { date: string; value: number } => row.value !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map((row) => row.value);
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mean = values.reduce((sum, value) => sum + value, 0) / values.length,
    median = quantile(sorted, 0.5)!,
    q1 = quantile(sorted, 0.25)!,
    q3 = quantile(sorted, 0.75)!,
    standardDeviation = Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
    ),
    coefficientOfVariation = standardDeviation / Math.max(Math.abs(mean), 1),
    deviations = values.map((value) => Math.abs(value - median)).sort((a, b) => a - b),
    medianAbsoluteDeviation = quantile(deviations, 0.5)!,
    outlierLimit = Math.max((q3 - q1) * 1.5, 1),
    outlierCount = values.filter(
      (value) => value < q1 - outlierLimit || value > q3 + outlierLimit,
    ).length,
    score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            coefficientOfVariation * 90 -
            (medianAbsoluteDeviation / Math.max(Math.abs(median), 1)) * 30 -
            (outlierCount / values.length) * 20,
        ),
      ),
    ),
    label =
      score >= 80 ? 'VERY STEADY' : score >= 65 ? 'STEADY' : score >= 45 ? 'MIXED' : 'BOOM / BUST';
  return {
    score,
    label,
    mean: round(mean),
    median: round(median),
    standardDeviation: round(standardDeviation),
    coefficientOfVariation: round(coefficientOfVariation),
    middle50Range: [round(q1), round(q3)] as [number, number],
    withinMiddle50: values.filter((value) => value >= q1 && value <= q3).length,
    games: values.length,
    outlierCount,
  };
}
