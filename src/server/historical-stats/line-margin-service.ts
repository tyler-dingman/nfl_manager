import { resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

const round = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const cushionThresholds = (statType: HistoricalStatType) =>
  ['RECEPTIONS', 'PASSING_TDS', 'RUSHING_TDS', 'RECEIVING_TDS', 'ANYTIME_TD'].includes(statType)
    ? [1, 2]
    : [10, 25, 50];
const marginLabel = (statType: HistoricalStatType, averageMargin: number | null) => {
  if (averageMargin === null) return null;
  const receptionScale = [
    'RECEPTIONS',
    'PASSING_TDS',
    'RUSHING_TDS',
    'RECEIVING_TDS',
    'ANYTIME_TD',
  ].includes(statType);
  const [some, comfortable, crushing] = receptionScale ? [0.5, 1.5, 2.5] : [10, 25, 50];
  return averageMargin < some
    ? 'BARELY CLEARING'
    : averageMargin < comfortable
      ? 'SOME CUSHION'
      : averageMargin < crushing
        ? 'COMFORTABLE CUSHION'
        : 'CRUSHING THE LINE';
};
export function calculateLineMargin(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
) {
  const values = games
      .map((game) => ({ date: game.date, value: resolveHistoricalStat(game, statType) }))
      .filter((row): row is { date: string; value: number } => row.value !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map((row) => row.value),
    margins = values.map((value) => (side === 'UNDER' ? line - value : value - line)),
    hits = margins.filter((margin) => margin > 0),
    misses = margins.filter((margin) => margin <= 0),
    averageMargin = mean(margins);
  return {
    average: mean(values) === null ? null : round(mean(values)!),
    median: median(values) === null ? null : round(median(values)!),
    averageMargin: averageMargin === null ? null : round(averageMargin),
    medianMargin: median(margins) === null ? null : round(median(margins)!),
    averageHitMargin: mean(hits) === null ? null : round(mean(hits)!),
    averageMissMargin: mean(misses) === null ? null : round(mean(misses)!),
    clearByBuckets: cushionThresholds(statType).map((amount) => ({
      amount,
      hits: margins.filter((margin) => margin >= amount).length,
      games: margins.length,
    })),
    label: marginLabel(statType, averageMargin),
    games: values.length,
  };
}
