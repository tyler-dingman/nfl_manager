import {
  applicationBackend,
  applicationStorage,
  applicationPublicCacheScope,
} from '../persistence/bindings';
import { PrecomputedProps } from '../../../packages/storage/parlay-scores';
import { isAnytimeTD } from '../../../packages/parlay/anytime-td';
import { cachePublicRead } from '@/server/cache/public-read-cache';
import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
import { buildGameScriptContext } from './game-script-context-service';
import { getLocalEventMarkets } from '@/server/odds/repository';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import {
  getOpponentPositionGameLogs,
  getPlayerGameLogs,
  getTeamSeasonStrength,
} from './repository';
import { normalizeHistoricalStatType } from './stat-resolver';
import { calculatePlayerPropTrend } from './trend-service';
import { evaluatePropSides } from './prop-side-research-service';
import { expectedOpportunity } from './expected-opportunity';
import { defenseContextForMarket, defenseContextLabel } from './market-defense-mapping';
import type { Sportsbook } from '@/server/odds/sportsbooks';
import {
  getRoleEvidence,
  getTeamResearchPlayerIds,
  getEventPriceHistory,
  marketMovement,
} from './role-repository';

export const supportsFullGameResearch = (period: unknown) => period === 'game';

type LocalMarket = {
  id: string;
  marketType: string;
  lineType?: 'main' | 'alternate' | 'unknown';
  mainLine?: number | null;
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
async function queryTrendingProps(
  eventId: string,
  opponentByTeam: Record<string, string> = {},
  season?: number,
  eventTeams?: { homeTeamId: string; awayTeamId: string },
  lineMode: 'standard' | 'alternate' | 'all' = 'all',
) {
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[];
  const candidates = markets.filter(
    (m) =>
      supportsFullGameResearch(m.period) &&
      m.available &&
      (lineMode === 'all' ||
        (lineMode === 'standard' && isAnytimeTD(m)) ||
        m.lineType === (lineMode === 'standard' ? 'main' : 'alternate')) &&
      (lineMode !== 'alternate' || (m.odds != null && m.odds >= -1000)) &&
      m.playerId &&
      trendingResearchLine(m) !== null &&
      (normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId))),
  );
  const asOf = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const teamIds = Object.keys(opponentByTeam);
  const [teammates, roleEvidence, prices] = await Promise.all([
    getTeamResearchPlayerIds(teamIds),
    Promise.all(
      teamIds.map(async (team) => [team, await getRoleEvidence([team], asOf)] as const),
    ).then((entries) => new Map(entries)),
    getEventPriceHistory(eventId, asOf),
  ]);
  const playerIds = [...new Set([...candidates.map((m) => m.playerId!), ...teammates])],
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
  const opponentLogs = new Map<string, Awaited<ReturnType<typeof getOpponentPositionGameLogs>>>(
    await Promise.all(
      [...strengths.keys()].flatMap((opponent) =>
        (['QB', 'RB', 'WR', 'TE'] as const).map(
          async (position) =>
            [
              `${opponent}|${position}`,
              await getOpponentPositionGameLogs(opponent, position),
            ] as const,
        ),
      ),
    ),
  );
  const identities = new Map(NFL_LEAGUE_DATA.players.map((p) => [p.id, p]));
  const logsByPlayer = new Map<string, Array<(typeof logs)[number]>>();
  for (const row of logs) {
    const group = logsByPlayer.get(row.playerId) ?? [];
    group.push(row);
    logsByPlayer.set(row.playerId, group);
  }
  const pricesBySelection = new Map<string, Array<(typeof prices)[number]>>();
  for (const row of prices) {
    const key = JSON.stringify([row.playerId, row.marketType, row.side]);
    const group = pricesBySelection.get(key) ?? [];
    group.push(row);
    pricesBySelection.set(key, group);
  }
  const scripts = new Map<string, ReturnType<typeof buildGameScriptContext>>();
  const researchByMarket = new Map<string, ReturnType<typeof evaluatePropSides>>();
  const opportunityByPlayer = new Map<string, ReturnType<typeof expectedOpportunity>>();
  return candidates
    .map((m) => {
      const statType =
        normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(String(m.statId));
      const researchLine = trendingResearchLine(m);
      if (!statType || !m.playerId || researchLine === null) return { ...m, trend: null };
      const playerGames = logsByPlayer.get(m.playerId) ?? [],
        identity = identities.get(m.playerId),
        teamId = m.teamId ?? identity?.teamAbbr ?? null,
        currentOpponentId = teamId ? opponentByTeam[teamId] : undefined;
      const strength = currentOpponentId ? strengths.get(currentOpponentId) : null;
      const roleContext = { asOf, teamId, ...(teamId ? roleEvidence.get(teamId) : {}) };
      const roleKey = `${m.playerId}|${teamId}`;
      const preparedOpportunity =
        opportunityByPlayer.get(roleKey) ?? expectedOpportunity(logs, m.playerId, roleContext);
      opportunityByPlayer.set(roleKey, preparedOpportunity);
      const scriptKey = `${teamId}|${statType}`;
      if (!scripts.has(scriptKey))
        scripts.set(
          scriptKey,
          eventTeams ? buildGameScriptContext(markets, teamId, statType, eventTeams) : null,
        );
      const script = scripts.get(scriptKey);
      const scoreContext = {
        strength,
        opponentLogs: opponentLogs.get(
          `${currentOpponentId}|${identity?.position ?? playerGames[0]?.position}`,
        ),
        position: identity?.position ?? playerGames[0]?.position,
        lineType: m.lineType as 'main' | 'alternate' | 'unknown' | undefined,
        mainLine: m.mainLine == null ? null : Number(m.mainLine),
        spread: script?.spread ?? null,
        projectionContext: {
          ...roleContext,
          preparedOpportunity,
          odds: m.odds,
          total: script?.total ?? null,
          marketContext: marketMovement(
            pricesBySelection.get(JSON.stringify([m.playerId, m.marketType, m.side])) ?? [],
            m,
          ),
        },
      };
      const researchKey = `${LAB_SCORE_CONFIG.version}|${m.playerId}|${statType}|${researchLine}|${m.side}|${m.sportsbook}|${m.lineType}|${m.mainLine}`;
      // Team-wide workload evidence was prepared above. Scoring only needs this
      // player's history; avoid scanning all teammates for every alternate line.
      const trend = calculatePlayerPropTrend(playerGames, {
        playerId: m.playerId,
        statType,
        line: researchLine,
        side: trendingResearchSide(m.side),
        currentOpponentId,
        ...scoreContext,
      });
      const labResearch =
        researchByMarket.get(researchKey) ??
        evaluatePropSides(
          { ...m, line: researchLine, side: trendingResearchSide(m.side) },
          playerGames,
          currentOpponentId,
          scoreContext,
          { side: trendingResearchSide(m.side), trend },
        );
      researchByMarket.set(researchKey, labResearch);
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
        line: m.line,
        side: m.side,
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

// Event + mode + model version cache holds threshold- and side-specific scores. Odds filters
// run against these priced results and never trigger a provider request or a new score calculation.
const cachedTrendingProps = cachePublicRead(
  (_modelVersion: string, ...args: Parameters<typeof queryTrendingProps>) =>
    queryTrendingProps(...args),
  { maxEntries: 32, scope: applicationPublicCacheScope },
);
export const computeTrendingProps = queryTrendingProps;
export async function getTrendingProps(...args: Parameters<typeof queryTrendingProps>) {
  if (applicationBackend() === 'd1') {
    const stored = await new PrecomputedProps(applicationStorage('D1_SHARED')).read(
      args[0],
      LAB_SCORE_CONFIG.version,
      args[1] ?? {},
      args[2],
      args[3],
    );
    if (stored) {
      const mode = args[4] ?? 'all';
      return stored.filter(
        (m: any) =>
          mode === 'all' ||
          (mode === 'standard' && (isAnytimeTD(m) || m.lineType === 'main')) ||
          (mode === 'alternate' && m.lineType === 'alternate' && m.odds != null && m.odds >= -1000),
      ) as Awaited<ReturnType<typeof queryTrendingProps>>;
    }
  }
  return cachedTrendingProps(LAB_SCORE_CONFIG.version, ...args);
}
