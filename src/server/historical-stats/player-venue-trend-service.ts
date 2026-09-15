import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';
import { venueContextForHistoricalGame, type VenueEnvironment } from './venue-environment-service';

type Row = { value: number; hit: boolean; margin: number; environment: VenueEnvironment };
const round = (value: number) => Math.round(value * 10) / 10;
const summarize = (rows: Row[]) => {
  const values = rows.map((row) => row.value).sort((a, b) => a - b),
    games = rows.length,
    hits = rows.filter((row) => row.hit).length,
    middle = Math.floor(games / 2),
    median = games
      ? games % 2
        ? values[middle]!
        : (values[middle - 1]! + values[middle]!) / 2
      : null;
  return {
    games,
    hits,
    hitRate: games ? round((hits / games) * 100) : null,
    average: games ? round(values.reduce((sum, value) => sum + value, 0) / games) : null,
    median: median === null ? null : round(median),
    averageMargin: games ? round(rows.reduce((sum, row) => sum + row.margin, 0) / games) : null,
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
const sample = (rows: Row[], environment: VenueEnvironment) =>
  summarize(rows.filter((row) => row.environment === environment));
export function calculatePlayerVenueTrends(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
) {
  const latestSeason = Math.max(...games.map((game) => game.season), 0),
    evaluated = games
      .map((game) => ({ game, value: resolveHistoricalStat(game, statType) }))
      .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null)
      .sort((a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime())
      .map(({ game, value }) => ({
        value,
        hit: didHit(value, line, side),
        margin: side === 'UNDER' ? line - value : value - line,
        environment: venueContextForHistoricalGame(game).environment,
        season: game.season,
      }));
  const build = (rows: typeof evaluated) => ({
    indoor: sample(rows, 'INDOOR'),
    outdoor: sample(rows, 'OUTDOOR'),
    unknown: { games: rows.filter((row) => row.environment === 'UNKNOWN').length },
  });
  return {
    ...build(evaluated),
    windows: {
      last5: build(evaluated.slice(0, 5)),
      last10: build(evaluated.slice(0, 10)),
      season: build(evaluated.filter((row) => row.season === latestSeason)),
      twoYear: build(evaluated),
    },
  };
}
