import { NextRequest, NextResponse } from 'next/server';
import { researchSeasonStats } from '@/server/historical-stats/research-season-stats';
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
import {
  getTrendingProps,
  supportsFullGameResearch,
} from '@/server/historical-stats/trending-props-service';
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
  lineType?: 'main' | 'alternate' | 'unknown';
  mainLine?: number | null;
};

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? 'game';
  if (!supportsFullGameResearch(period))
    return NextResponse.json(
      {
        error:
          'Research currently supports full-game markets only. Quarter and half props require period-specific history.',
      },
      { status: 422 },
    );
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
  if (eventId === 'ALL') {
    const marketGroups = await Promise.all(
      events.map(async (candidate) => {
        const opponents: Record<string, string> = {
          [candidate.homeTeamId]: candidate.awayTeamId,
          [candidate.awayTeamId]: candidate.homeTeamId,
        };
        const markets = await getTrendingProps(
          candidate.id,
          opponents,
          candidate.season,
          candidate,
        );
        return markets.map((market) => ({ ...market, eventId: candidate.id }));
      }),
    );
    return NextResponse.json({ markets: marketGroups.flat() });
  }
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
    return NextResponse.json({
      markets: (await getTrendingProps(eventId, opponents, event.season, event)).map((market) => ({
        ...market,
        eventId,
      })),
    });
  const statType = normalizeHistoricalStatType(marketType);
  if (!statType)
    return NextResponse.json({ error: 'Historical stat type is unsupported' }, { status: 400 });
  const markets = (await getLocalEventMarkets(eventId)) as unknown as LocalMarket[],
    playerMarkets = markets.filter(
      (m) =>
        supportsFullGameResearch(m.period) &&
        m.playerId === playerId &&
        m.marketType === marketType &&
        m.side === side,
    ),
    selected =
      playerMarkets.find(
        (m) =>
          Number(m.line) === line &&
          m.sportsbook === request.nextUrl.searchParams.get('sportsbook'),
      ) ?? playerMarkets.find((m) => Number(m.line) === line),
    identity = NFL_LEAGUE_DATA.players.find((player) => player.id === playerId),
    teamId = selected?.teamId ?? identity?.teamAbbr ?? null,
    opponentId = teamId ? opponents[teamId] : undefined,
    position = identity?.position as 'QB' | 'RB' | 'WR' | 'TE' | undefined;
  const currentStrengthSeason = event.season - 1;
  const currentOpponentStrength = opponentId
    ? await getTeamSeasonStrength(opponentId, currentStrengthSeason)
    : null;
  const logs = await getPlayerGameLogs([playerId]),
    summary = calculatePlayerPropTrend(logs, {
      playerId,
      statType,
      line,
      side,
      currentOpponentId: opponentId,
      currentHomeAway: teamId === event.homeTeamId ? 'HOME' : 'AWAY',
      strength: currentOpponentStrength,
      position,
      lineType: selected?.lineType,
      mainLine: selected?.mainLine,
      spread: buildGameScriptContext(markets, teamId, statType, event)?.spread,
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
  const opponentIdentity = NFL_LEAGUE_DATA.teams.find(
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
    summary.researchScore.matchup.alignment === 'conflicts'
      ? `${opponentId}'s ${summary.researchScore.matchup.metric?.toLowerCase()} context works against the selected ${side.toLowerCase()}. ${summary.researchScore.matchup.contextualOnly ? 'This is broad yardage context, not a forecast of usage or role.' : 'This is context, not a prediction.'}`
      : summary.researchScore.matchup.label + '.';
  // Single score for the table, modal hero, and legacy match-score field.
  const labMatchScore = summary.trendScore;
  return NextResponse.json({
    player: {
      id: playerId,
      name: selected?.playerName ?? identity?.name ?? 'Player',
      teamId,
      position,
    },
    event,
    market: { marketType, statType, line, side, opponentId: opponentId ?? null },
    seasonStats: researchSeasonStats(logs, statType, position),
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
        ? {
            ...buildUpcomingMatchup(
              opponentId,
              opponentIdentity?.name ?? opponentId,
              defenseContext,
              currentOpponentStrength,
            ),
            matchupLabel: summary.researchScore.matchup.label,
          }
        : null,
    generatedInsight: supportedInsight,
    labMatchScore,
  });
}
