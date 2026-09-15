import { getLocalEventMarkets } from '@/server/odds/repository';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getPlayerGameLogs } from './repository';
import { normalizeHistoricalStatType } from './stat-resolver';
import { calculatePlayerPropTrend } from './trend-service';
import type { Sportsbook } from '@/server/odds/sportsbooks';

type LocalMarket = {
  id: string;
  marketType: string;
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
export async function getTrendingProps(
  eventId: string,
  opponentByTeam: Record<string, string> = {},
) {
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[];
  const candidates = markets.filter(
    (m) =>
      m.available &&
      m.playerId &&
      m.line !== null &&
      (normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId))),
  );
  const playerIds = [...new Set(candidates.map((m) => m.playerId!))],
    logs = await getPlayerGameLogs(playerIds);
  return candidates
    .map((m) => {
      const statType =
        normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId));
      if (!statType || !m.playerId || m.line === null) return { ...m, trend: null };
      const playerGames = logs.filter((g) => g.playerId === m.playerId),
        identity = NFL_LEAGUE_DATA.players.find((player) => player.id === m.playerId),
        teamId = m.teamId ?? identity?.teamAbbr ?? null,
        currentOpponentId = teamId ? opponentByTeam[teamId] : undefined;
      const trend = calculatePlayerPropTrend(playerGames, {
        playerId: m.playerId,
        statType,
        line: Number(m.line),
        side: m.side === 'UNDER' ? 'UNDER' : 'OVER',
        currentOpponentId,
      });
      return {
        ...m,
        teamId,
        position: identity?.position ?? playerGames[0]?.position ?? null,
        headshotUrl: identity?.headshotUrl ?? null,
        trend: trend.last2Years.games >= 5 ? trend : null,
        researchStatus:
          trend.last2Years.games >= 5 ? 'FULL' : trend.last2Years.games ? 'PARTIAL' : 'NONE',
      };
    })
    .sort((a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1));
}
