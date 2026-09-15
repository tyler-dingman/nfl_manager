import { NextRequest, NextResponse } from 'next/server';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getGameByGameTrend } from '@/server/historical-stats/game-by-game-trend-service';
import { buildGameScriptContext } from '@/server/historical-stats/game-script-context-service';
import { deriveGameEnvironment } from '@/server/historical-stats/game-environment-service';
import {
  buildGameEnvironmentInsights,
  relevantEnvironmentSplits,
} from '@/server/historical-stats/game-environment-insight-service';
import { buildLineLadder } from '@/server/historical-stats/line-ladder-service';
import { buildLineLadderInsight } from '@/server/historical-stats/line-ladder-insight-service';
import { calculateLineMargin } from '@/server/historical-stats/line-margin-service';
import { calculateOpponentVsPosition } from '@/server/historical-stats/opponent-vs-position-service';
import {
  getOpponentPositionGameLogs,
  getPlayerGameLogs,
  getTeamSeasonStrength,
} from '@/server/historical-stats/repository';
import { getPropMissContext } from '@/server/historical-stats/prop-miss-context-service';
import { buildResultDistribution } from '@/server/historical-stats/result-distribution-service';
import {
  defenseContextForMarket,
  defenseContextLabel,
} from '@/server/historical-stats/market-defense-mapping';
import { normalizeHistoricalStatType } from '@/server/historical-stats/stat-resolver';
import { calculatePlayerPropTrend } from '@/server/historical-stats/trend-service';
import { calculatePlayerEnvironmentTrends } from '@/server/historical-stats/player-environment-trend-service';
import { calculatePlayerConsistency } from '@/server/historical-stats/player-consistency-service';
import { calculatePlayerUsageTrend } from '@/server/historical-stats/player-usage-trend-service';
import { calculatePlayerVenueTrends } from '@/server/historical-stats/player-venue-trend-service';
import { getTrendingProps } from '@/server/historical-stats/trending-props-service';
import { buildUpcomingMatchup } from '@/server/historical-stats/upcoming-matchup-service';
import { buildVenueInsight } from '@/server/historical-stats/venue-insight-service';
import { venueContextForHomeTeam } from '@/server/historical-stats/venue-environment-service';
import { getLocalEventMarkets, listLocalOddsEvents } from '@/server/odds/repository';
import type { Sportsbook } from '@/server/odds/sportsbooks';

export const dynamic = 'force-dynamic';
type LocalMarket = {
  id: string;
  playerId: string | null;
  playerName: string | null;
  marketType: string;
  entityId: string;
  line: number | null;
  side: string;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
  teamId: string | null;
  period: string;
  isAltLine: boolean;
};

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  const events = (await listLocalOddsEvents()) as unknown as Array<{
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    week: number;
    kickoffAt: string;
    season: number;
  }>;
  const event = events.find((item) => item.id === eventId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const opponents: Record<string, string> = {
    [event.homeTeamId]: event.awayTeamId,
    [event.awayTeamId]: event.homeTeamId,
  };
  const playerId = request.nextUrl.searchParams.get('playerId'),
    marketType = request.nextUrl.searchParams.get('marketType'),
    line = Number(request.nextUrl.searchParams.get('line')),
    side =
      request.nextUrl.searchParams.get('side') === 'UNDER' ? ('UNDER' as const) : ('OVER' as const);
  if (!playerId || !marketType || !Number.isFinite(line))
    return NextResponse.json({ markets: await getTrendingProps(eventId, opponents) });
  const statType = normalizeHistoricalStatType(marketType);
  if (!statType)
    return NextResponse.json({ error: 'Historical stat type is unsupported' }, { status: 400 });
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[],
    playerMarkets = markets.filter(
      (m) => m.playerId === playerId && m.marketType === marketType && m.side === side,
    ),
    selected = playerMarkets.find((m) => Number(m.line) === line),
    identity = NFL_LEAGUE_DATA.players.find((player) => player.id === playerId),
    teamId = selected?.teamId ?? identity?.teamAbbr ?? null,
    opponentId = teamId ? opponents[teamId] : undefined,
    position = identity?.position as 'QB' | 'RB' | 'WR' | 'TE' | undefined;
  const logs = await getPlayerGameLogs([playerId]),
    summary = calculatePlayerPropTrend(logs, {
      playerId,
      statType,
      line,
      side,
      currentOpponentId: opponentId,
      currentHomeAway: teamId === event.homeTeamId ? 'HOME' : 'AWAY',
    }),
    lineLadder = buildLineLadder(logs, statType, line, side, playerMarkets),
    gameByGame = getGameByGameTrend(logs, statType, line, side, 40),
    distribution = buildResultDistribution(logs, statType);
  const lineLadderInsight = buildLineLadderInsight(
    lineLadder.rows,
    selected?.playerName ?? identity?.name ?? 'This player',
  );
  const usage = calculatePlayerUsageTrend(logs, statType),
    lineMargin = calculateLineMargin(logs, statType, line, side),
    consistency = calculatePlayerConsistency(logs, statType),
    gameScript = buildGameScriptContext(markets, teamId, statType, {
      homeTeamId: event.homeTeamId,
      awayTeamId: event.awayTeamId,
    }),
    venueSplits = calculatePlayerVenueTrends(logs, statType, line, side),
    currentVenue = venueContextForHomeTeam(event.homeTeamId),
    venueInsight = buildVenueInsight(
      selected?.playerName ?? identity?.name ?? 'This player',
      statType,
      line,
      side,
      currentVenue.environment,
      venueSplits.indoor,
      venueSplits.outdoor,
    );
  const priorTeamEvent = teamId
      ? events
          .filter(
            (candidate) =>
              candidate.id !== event.id &&
              candidate.season === event.season &&
              [candidate.homeTeamId, candidate.awayTeamId].includes(teamId) &&
              new Date(candidate.kickoffAt) < new Date(event.kickoffAt),
          )
          .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())[0]
      : undefined,
    currentEnvironment = deriveGameEnvironment(
      event.kickoffAt,
      event.week === 1 ? null : priorTeamEvent?.kickoffAt,
    ),
    environmentSplits = calculatePlayerEnvironmentTrends(logs, statType, line, side),
    relevantSplits = relevantEnvironmentSplits(currentEnvironment, environmentSplits),
    environmentInsights = buildGameEnvironmentInsights(
      selected?.playerName ?? identity?.name ?? 'This player',
      statType,
      line,
      side,
      relevantSplits,
    );
  const missContext = getPropMissContext(logs, statType, line, side);
  const opponentLogs =
      opponentId && position && ['QB', 'RB', 'WR', 'TE'].includes(position)
        ? await getOpponentPositionGameLogs(opponentId, position)
        : [],
    opponentVsPosition =
      opponentId && position && opponentLogs.length
        ? calculateOpponentVsPosition(opponentLogs, position, statType, line, side)
        : null;
  const currentStrengthSeason = 2025,
    currentOpponentStrength = opponentId
      ? await getTeamSeasonStrength(opponentId, currentStrengthSeason)
      : null,
    opponentIdentity = NFL_LEAGUE_DATA.teams.find(
      (team) => team.id === opponentId || team.abbr === opponentId,
    ),
    defenseContext = defenseContextForMarket(statType);
  const currentDefenseRank = currentOpponentStrength
    ? defenseContext === 'PASS'
      ? currentOpponentStrength.passDefenseRank
      : defenseContext === 'RUSH'
        ? currentOpponentStrength.rushDefenseRank
        : defenseContext === 'SCORING'
          ? currentOpponentStrength.scoringDefenseRank
          : currentOpponentStrength.totalDefenseRank
    : null;
  const supportedInsight =
    summary.last10.games > 0 &&
    missContext.misses.length === 1 &&
    missContext.misses[0]!.opponentRelevantDefenseRank !== null &&
    currentDefenseRank !== null
      ? `${selected?.playerName ?? identity?.name ?? 'This player'} has cleared this line in ${summary.last10.hits} of the last ${summary.last10.games} games. The only miss came against a defense that finished #${missContext.misses[0]!.opponentRelevantDefenseRank} in ${defenseContextLabel(defenseContext).toLowerCase()}. This week's opponent finished #${currentDefenseRank}.`
      : null;
  const labSignals = [
      { weight: 50, value: summary.trendScore },
      ...(missContext.missContextScore === null
        ? []
        : [{ weight: 15, value: missContext.missContextScore }]),
      ...(currentDefenseRank === null
        ? []
        : [{ weight: 20, value: (currentDefenseRank / 32) * 100 }]),
      ...(opponentVsPosition?.last10.hitRate === null ||
      opponentVsPosition?.last10.hitRate === undefined
        ? []
        : [{ weight: 15, value: opponentVsPosition.last10.hitRate }]),
      ...(usage.trendPct === null
        ? []
        : [{ weight: 8, value: Math.max(0, Math.min(100, 50 + usage.trendPct)) }]),
      ...(lineMargin.label === null
        ? []
        : [
            {
              weight: 8,
              value:
                (
                  {
                    'BARELY CLEARING': 40,
                    'SOME CUSHION': 60,
                    'COMFORTABLE CUSHION': 80,
                    'CRUSHING THE LINE': 90,
                  } as Record<string, number>
                )[lineMargin.label] ?? 50,
            },
          ]),
      ...(consistency ? [{ weight: 8, value: consistency.score }] : []),
      ...(gameScript
        ? [
            {
              weight: 4,
              value: /support|favorable/i.test(gameScript.relevantInsight) ? 60 : 45,
            },
          ]
        : []),
      ...(currentVenue.environment === 'UNKNOWN' ||
      (currentVenue.environment === 'INDOOR' ? venueSplits.indoor : venueSplits.outdoor).games < 5
        ? []
        : [
            {
              weight: 5,
              value:
                (currentVenue.environment === 'INDOOR' ? venueSplits.indoor : venueSplits.outdoor)
                  .hitRate ?? 50,
            },
          ]),
    ],
    labWeight = labSignals.reduce((sum, signal) => sum + signal.weight, 0),
    labMatchScore = Math.round(
      labSignals.reduce((sum, signal) => sum + signal.weight * signal.value, 0) / labWeight,
    );
  return NextResponse.json({
    player: {
      id: playerId,
      name: selected?.playerName ?? identity?.name ?? 'Player',
      teamId,
      position,
    },
    event,
    market: { marketType, statType, line, side, opponentId: opponentId ?? null },
    currentPrices: playerMarkets.filter((m) => Number(m.line) === line && m.available),
    summary,
    gameByGame,
    lineLadder,
    lineLadderInsight,
    usage,
    lineMargin,
    consistency,
    gameScript,
    venue: {
      current: currentVenue,
      splits: {
        indoor: venueSplits.indoor,
        outdoor: venueSplits.outdoor,
        unknown: venueSplits.unknown,
      },
      windows: venueSplits.windows,
      relevantInsight: venueInsight,
    },
    environment: {
      currentGame: currentEnvironment,
      splits: environmentSplits,
      relevantSplits,
      insights: environmentInsights,
    },
    distribution,
    opponentVsPosition,
    missContext,
    currentOpponentStrength: currentOpponentStrength
      ? {
          season: currentStrengthSeason,
          defenseContext,
          defenseLabel: defenseContextLabel(defenseContext),
          rank: currentDefenseRank,
          strength: currentOpponentStrength,
        }
      : null,
    upcomingMatchup:
      currentOpponentStrength && opponentId
        ? buildUpcomingMatchup(
            opponentId,
            opponentIdentity?.name ?? opponentId,
            defenseContext,
            currentOpponentStrength,
          )
        : null,
    generatedInsight: supportedInsight,
    labMatchScore,
  });
}
