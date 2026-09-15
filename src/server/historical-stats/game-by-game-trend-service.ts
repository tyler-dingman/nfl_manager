import { didHit, resolveHistoricalStat } from './stat-resolver';
import { deriveHistoricalGameContext } from './game-environment-service';
import { venueContextForHistoricalGame } from './venue-environment-service';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

export function getGameByGameTrend(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
  limit = 10,
) {
  return games
    .map((game) => ({ game, value: resolveHistoricalStat(game, statType) }))
    .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null)
    .sort((a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime())
    .slice(0, limit)
    .map(({ game, value }) => ({
      gameId: game.gameId,
      date: game.date,
      season: game.season,
      week: game.week,
      opponent: game.opponentTeamId,
      homeAway: game.homeAway,
      value,
      line,
      result: didHit(value, line, side) ? ('HIT' as const) : ('MISS' as const),
      margin: Math.round((side === 'UNDER' ? line - value : value - line) * 10) / 10,
      targets: game.targets,
      opponentSeasonStrength: game.opponentSeasonStrength ?? null,
      environment: deriveHistoricalGameContext(game),
      venue: venueContextForHistoricalGame(game),
    }))
    .reverse();
}
