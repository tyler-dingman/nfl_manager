import { resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

type Definition = { label: string; min: number; max: number };
const definitions = (type: HistoricalStatType): Definition[] => {
  if (type === 'RECEPTIONS')
    return [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, Infinity],
    ].map(([min, max], i) => ({ min: min!, max: max!, label: i === 4 ? '8+' : `${min}-${max}` }));
  if (['PASSING_YARDS', 'PASSING_RUSHING_YARDS'].includes(type))
    return [
      { label: '<200', min: -Infinity, max: 199 },
      { label: '200-224', min: 200, max: 224 },
      { label: '225-249', min: 225, max: 249 },
      { label: '250-274', min: 250, max: 274 },
      { label: '275-299', min: 275, max: 299 },
      { label: '300+', min: 300, max: Infinity },
    ];
  if (type === 'RUSHING_YARDS')
    return [
      { label: '<40', min: -Infinity, max: 39 },
      { label: '40-49', min: 40, max: 49 },
      { label: '50-59', min: 50, max: 59 },
      { label: '60-79', min: 60, max: 79 },
      { label: '80-99', min: 80, max: 99 },
      { label: '100+', min: 100, max: Infinity },
    ];
  if (['RECEIVING_YARDS', 'RUSH_RECEIVE_YARDS', 'RUSHING_RECEIVING_YARDS'].includes(type))
    return [
      { label: '<25', min: -Infinity, max: 24 },
      { label: '25-39', min: 25, max: 39 },
      { label: '40-59', min: 40, max: 59 },
      { label: '60-79', min: 60, max: 79 },
      { label: '80-99', min: 80, max: 99 },
      { label: '100+', min: 100, max: Infinity },
    ];
  return [
    { label: '0', min: 0, max: 0 },
    { label: '1', min: 1, max: 1 },
    { label: '2', min: 2, max: 2 },
    { label: '3+', min: 3, max: Infinity },
  ];
};

export function buildResultDistribution(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  limit = 40,
) {
  const values = games
    .map((g) => resolveHistoricalStat(g, statType))
    .filter((v): v is number => v !== null)
    .slice(0, limit);
  const bins = definitions(statType).map((bin) => {
    const count = values.filter((v) => v >= bin.min && v <= bin.max).length;
    return {
      label: bin.label,
      games: count,
      percentage: values.length ? Math.round((count / values.length) * 1000) / 10 : 0,
    };
  });
  return { sampleSize: values.length, bins: bins.filter((bin) => bin.games > 0) };
}
