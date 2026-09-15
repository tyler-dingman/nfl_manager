import type { HistoricalPlayerGame, HistoricalStatType } from './types';

export const USAGE_RISING_THRESHOLD = 15;
export const USAGE_FALLING_THRESHOLD = -15;
type UsageMetric = 'Attempts' | 'Carries' | 'Targets' | 'Touches' | 'Opportunities';
const round = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) =>
  values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const metricFor = (statType: HistoricalStatType): UsageMetric =>
  statType === 'PASSING_RUSHING_YARDS'
    ? 'Opportunities'
    : [
    'PASSING_YARDS',
    'PASSING_TDS',
    'PASSING_COMPLETIONS',
    'PASSING_ATTEMPTS',
    'INTERCEPTIONS',
  ].includes(statType)
    ? 'Attempts'
    : ['RUSHING_YARDS', 'RUSHING_ATTEMPTS', 'RUSHING_TDS'].includes(statType)
      ? 'Carries'
      : ['RUSH_RECEIVE_YARDS', 'RUSHING_RECEIVING_YARDS'].includes(statType)
        ? 'Touches'
        : 'Targets';
const valueFor = (game: HistoricalPlayerGame, metric: UsageMetric) => {
  if (metric === 'Attempts') return game.passingAttempts;
  if (metric === 'Carries') return game.carries;
  if (metric === 'Targets') return game.targets;
  if (metric === 'Opportunities') {
    if (game.passingAttempts === null && game.carries === null) return null;
    return (game.passingAttempts ?? 0) + (game.carries ?? 0);
  }
  if (game.carries === null && game.receptions === null) return null;
  return (game.carries ?? 0) + (game.receptions ?? 0);
};
export function calculatePlayerUsageTrend(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
) {
  const primaryMetric = metricFor(statType),
    values = games
      .map((game) => ({
        date: game.date,
        season: game.season,
        value: valueFor(game, primaryMetric),
      }))
      .filter((row): row is { date: string; season: number; value: number } => row.value !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    recent = values.map((row) => row.value),
    last5 = average(recent.slice(0, 5)),
    previous5 = average(recent.slice(5, 10)),
    trendPct =
      last5 === null || previous5 === null || previous5 === 0
        ? null
        : round(((last5 - previous5) / previous5) * 100),
    latestSeason = Math.max(...values.map((row) => row.season), 0),
    trendLabel =
      trendPct === null
        ? null
        : trendPct >= USAGE_RISING_THRESHOLD
          ? 'RISING'
          : trendPct <= USAGE_FALLING_THRESHOLD
            ? 'FALLING'
            : 'STABLE';
  return {
    primaryMetric,
    last3: average(recent.slice(0, 3)),
    last5,
    previous5,
    last10: average(recent.slice(0, 10)),
    season: average(values.filter((row) => row.season === latestSeason).map((row) => row.value)),
    twoYear: average(recent),
    trendPct,
    trendLabel,
    series: values.slice(0, 10).reverse(),
  };
}
