import { defenseContextForMarket } from './market-defense-mapping';
import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

export function getPropMissContext(
  games: HistoricalPlayerGame[],
  statType: HistoricalStatType,
  line: number,
  side: 'OVER' | 'UNDER',
  limit = 10,
) {
  const context = defenseContextForMarket(statType);
  const relevant = (game: HistoricalPlayerGame) => {
    const strength = game.opponentSeasonStrength;
    if (!strength) return null;
    if (context === 'PASS')
      return { rank: strength.passDefenseRank, metric: strength.passingYardsAllowedPerGame };
    if (context === 'RUSH')
      return { rank: strength.rushDefenseRank, metric: strength.rushingYardsAllowedPerGame };
    if (context === 'SCORING')
      return { rank: strength.scoringDefenseRank, metric: strength.pointsAllowedPerGame };
    return { rank: strength.totalDefenseRank, metric: strength.totalYardsAllowedPerGame };
  };
  const misses = games
    .map((game) => ({ game, value: resolveHistoricalStat(game, statType) }))
    .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null)
    .sort((a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime())
    .slice(0, limit)
    .filter(({ value }) => !didHit(value, line, side))
    .map(({ game, value }) => ({
      gameId: game.gameId,
      season: game.season,
      opponent: game.opponentTeamId,
      statValue: value,
      opponentRelevantDefenseRank: relevant(game)?.rank ?? null,
      opponentRelevantDefenseMetric: relevant(game)?.metric ?? null,
    }));
  const ranked = misses.filter((m) => m.opponentRelevantDefenseRank !== null);
  const averageRank = ranked.length
    ? Math.round(
        (ranked.reduce((sum, m) => sum + m.opponentRelevantDefenseRank!, 0) / ranked.length) * 10,
      ) / 10
    : null;
  return {
    defenseContext: context,
    misses,
    averageRelevantDefenseRank: averageRank,
    missContextScore: averageRank === null ? null : Math.round(((33 - averageRank) / 32) * 100),
  };
}
