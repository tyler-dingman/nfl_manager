import { buildGameScriptContext } from './game-script-context-service';
import { getLocalEventMarkets } from '@/server/odds/repository';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getPlayerGameLogs, getTeamSeasonStrength } from './repository';
import { normalizeHistoricalStatType } from './stat-resolver';
import { calculatePlayerPropTrend } from './trend-service';
import { evaluatePropSides } from './prop-side-research-service';
import { defenseContextForMarket, defenseContextLabel } from './market-defense-mapping';
import type { Sportsbook } from '@/server/odds/sportsbooks';

export const supportsFullGameResearch = (period: unknown) => period === 'game';

type LocalMarket = {
  id: string;
  marketType: string;
  statId: string;
  playerId: string | null;
  teamId: string | null;
  side: string;
  line: number | null;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
  [key: string]: unknown;
};
export const trendingResearchLine = (
  market: Pick<LocalMarket, 'marketType' | 'statId' | 'line'>,
) => {
  if (market.line !== null) return Number(market.line);
  const statType =
    normalizeHistoricalStatType(market.marketType) ??
    normalizeHistoricalStatType(String(market.statId));
  return statType === 'ANYTIME_TD' ? 0.5 : null;
};
const trendingResearchSide = (side: string) =>
  side === 'UNDER' || side === 'NO' ? ('UNDER' as const) : ('OVER' as const);
export async function getTrendingProps(
  eventId: string,
  opponentByTeam: Record<string, string> = {},
  season?: number,
  eventTeams?: { homeTeamId: string; awayTeamId: string },
) {
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[];
  const candidates = markets.filter(
    (m) =>
      supportsFullGameResearch(m.period) &&
      m.available &&
      m.playerId &&
      trendingResearchLine(m) !== null &&
      (normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId))),
  );
  const playerIds = [...new Set(candidates.map((m) => m.playerId!))],
    logs = await getPlayerGameLogs(playerIds);
  const strengthSeason =
    (season ?? Math.max(...logs.map((g) => g.season), new Date().getFullYear())) - 1;
  const strengths = new Map(
    await Promise.all(
      [...new Set(Object.values(opponentByTeam))].map(
        async (opponent) =>
          [opponent, await getTeamSeasonStrength(opponent, strengthSeason)] as const,
      ),
    ),
  );
  const researchByMarket = new Map<string, ReturnType<typeof evaluatePropSides>>();
  return candidates
    .map((m) => {
      const statType =
        normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId));
      const researchLine = trendingResearchLine(m);
      if (!statType || !m.playerId || researchLine === null) return { ...m, trend: null };
      const playerGames = logs.filter((g) => g.playerId === m.playerId),
        identity = NFL_LEAGUE_DATA.players.find((player) => player.id === m.playerId),
        teamId = m.teamId ?? identity?.teamAbbr ?? null,
        currentOpponentId = teamId ? opponentByTeam[teamId] : undefined;
      const strength = currentOpponentId ? strengths.get(currentOpponentId) : null;
      const scoreContext = {
        strength,
        position: identity?.position ?? playerGames[0]?.position,
        lineType: m.lineType as 'main' | 'alternate' | 'unknown' | undefined,
        mainLine: m.mainLine == null ? null : Number(m.mainLine),
        spread: eventTeams
          ? buildGameScriptContext(markets, teamId, statType, eventTeams)?.spread
          : null,
      };
      const researchKey = `${m.playerId}|${statType}|${researchLine}|${m.sportsbook}|${m.lineType}|${m.mainLine}`;
      const labResearch =
        researchByMarket.get(researchKey) ??
        evaluatePropSides(
          { ...m, line: researchLine, side: trendingResearchSide(m.side) },
          playerGames,
          currentOpponentId,
          scoreContext,
        );
      researchByMarket.set(researchKey, labResearch);
      const trend = calculatePlayerPropTrend(playerGames, {
        playerId: m.playerId,
        statType,
        line: researchLine,
        side: trendingResearchSide(m.side),
        currentOpponentId,
        ...scoreContext,
      });
      const context = defenseContextForMarket(statType);
      const rank = strength
        ? context === 'PASS'
          ? strength.passDefenseRank
          : context === 'RUSH'
            ? strength.rushDefenseRank
            : context === 'SCORING'
              ? strength.scoringDefenseRank
              : strength.totalDefenseRank
        : null;
      return {
        ...m,
        matchup: {
          opponentId: currentOpponentId ?? null,
          rank,
          label: defenseContextLabel(context).replace('Defense', 'D'),
          season: strength?.season ?? null,
          alignment: trend.researchScore.matchup.alignment,
          explanation: trend.researchScore.matchup.label,
        },
        line: researchLine,
        side: trendingResearchSide(m.side),
        teamId,
        position: identity?.position ?? playerGames[0]?.position ?? null,
        headshotUrl: identity?.headshotUrl ?? null,
        labResearch,
        trend: trend.last2Years.games >= 5 ? trend : null,
        researchStatus:
          trend.last2Years.games >= 5 ? 'FULL' : trend.last2Years.games ? 'PARTIAL' : 'NONE',
      };
    })
    .sort((a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1));
}
