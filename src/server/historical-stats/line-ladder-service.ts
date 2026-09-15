import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';
import { formatLineLadderThreshold } from '@/lib/parlay-lab/market-display';
import type { Sportsbook } from '@/server/odds/sportsbooks';

type PriceMarket = {
  id: string;
  line: number | null;
  side: string;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
};
const rate = (values: number[], line: number, side: string) => {
  const hits = values.filter((v) => didHit(v, line, side)).length;
  return {
    games: values.length,
    hits,
    hitRate: values.length ? Math.round((hits / values.length) * 1000) / 10 : null,
  };
};
const increment = (type: HistoricalStatType) =>
  ['PASSING_YARDS', 'PASSING_RUSHING_YARDS'].includes(type)
    ? 25
    : [
          'RUSHING_YARDS',
          'RECEIVING_YARDS',
          'RUSH_RECEIVE_YARDS',
          'RUSHING_RECEIVING_YARDS',
        ].includes(type)
      ? 5
      : 1;
export function buildLineLadder(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  currentLine: number,
  side: 'OVER' | 'UNDER',
  markets: PriceMarket[],
  sampleWindow = 10,
) {
  const allRows = games
      .map((g) => ({ game: g, value: resolveHistoricalStat(g, statType) }))
      .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null),
    values = allRows.map((row) => row.value).slice(0, sampleWindow),
    available = [
      ...new Set(
        markets.filter((m) => m.side === side && m.line !== null).map((m) => Number(m.line)),
      ),
    ],
    step = increment(statType);
  let thresholds = available;
  if (thresholds.length < 5)
    thresholds = [
      ...new Set([
        ...thresholds,
        ...[-2, -1, 0, 1, 2].map((offset) => currentLine + offset * step).filter((v) => v >= 0),
      ]),
    ];
  thresholds.sort((a, b) => a - b);
  const rows = thresholds.map((threshold) => {
    const matching = markets.filter(
        (m) => m.side === side && Number(m.line) === threshold && m.available,
      ),
      last5 = rate(values.slice(0, 5), threshold, side),
      last10 = rate(values, threshold, side),
      latestSeason = Math.max(...allRows.map((row) => row.game.season), 0),
      season = rate(
        allRows.filter((row) => row.game.season === latestSeason).map((row) => row.value),
        threshold,
        side,
      ),
      last2Years = rate(
        allRows.map((row) => row.value),
        threshold,
        side,
      ),
      averageMargin = values.length
        ? Math.round(
            (values.reduce(
              (sum, v) => sum + (side === 'UNDER' ? threshold - v : v - threshold),
              0,
            ) /
              values.length) *
              10,
          ) / 10
        : null;
    return {
      threshold,
      displayThreshold: formatLineLadderThreshold(statType, threshold, side),
      last5,
      last10,
      season,
      last2Years,
      hits: last10.hits,
      games: last10.games,
      hitRate: last10.hitRate,
      averageMargin,
      fanduelPrice: matching.find((m) => m.sportsbook === 'FANDUEL')?.odds ?? null,
      draftkingsPrice: matching.find((m) => m.sportsbook === 'DRAFTKINGS')?.odds ?? null,
      isCurrentLine: threshold === currentLine,
      isAvailable: matching.length > 0,
      markets: matching,
    };
  });
  const eligible = rows.filter((r) => r.isAvailable && (r.hitRate ?? 0) >= 60),
    sweetSpot = (side === 'OVER' ? eligible.at(-1) : eligible[0]) ?? null;
  return {
    rows,
    ladderSweetSpot: sweetSpot
      ? `${sweetSpot.displayThreshold} cleared in ${sweetSpot.hits} of the last ${sweetSpot.games} qualifying games and is currently available.`
      : null,
  };
}
