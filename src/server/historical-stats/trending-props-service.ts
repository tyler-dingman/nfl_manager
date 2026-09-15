import { getLocalEventMarkets } from '@/server/odds/repository';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getPlayerGameLogs } from './repository';
import { normalizeHistoricalStatType } from './stat-resolver';
import { calculatePlayerPropTrend } from './trend-service';
import { evaluatePropSides } from './prop-side-research-service';
import type { Sportsbook } from '@/server/odds/sportsbooks';

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
) {
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[];
  const candidates = markets.filter(
    (m) =>
      m.available &&
      m.playerId &&
      trendingResearchLine(m) !== null &&
      (normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId))),
  );
  const playerIds = [...new Set(candidates.map((m) => m.playerId!))],
    logs = await getPlayerGameLogs(playerIds);
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
      const researchKey = `${m.playerId}|${statType}|${researchLine}`;
      const labResearch =
        researchByMarket.get(researchKey) ??
        evaluatePropSides(
          { ...m, line: researchLine, side: trendingResearchSide(m.side) },
          playerGames,
          currentOpponentId,
        );
      researchByMarket.set(researchKey, labResearch);
      const trend = calculatePlayerPropTrend(playerGames, {
        playerId: m.playerId,
        statType,
        line: researchLine,
        side: trendingResearchSide(m.side),
        currentOpponentId,
      });
      return {
        ...m,
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
