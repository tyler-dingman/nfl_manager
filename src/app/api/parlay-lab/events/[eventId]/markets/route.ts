import { NextRequest, NextResponse } from 'next/server';
import { getLocalEventMarkets } from '@/server/odds/repository';
import { listLocalOddsEvents } from '@/server/odds/repository';
import { getPlayerGameLogs } from '@/server/historical-stats/repository';
import { evaluatePropSides } from '@/server/historical-stats/prop-side-research-service';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import {
  normalizeHistoricalStatType,
  resolveHistoricalStat,
} from '@/server/historical-stats/stat-resolver';

type RouteMarket = {
  id: string;
  playerId: string | null;
  teamId: string | null;
  marketType: string;
  statId: string;
  period: string;
  line: number | null;
  side: string;
  isAltLine: boolean;
  [key: string]: unknown;
};

export async function GET(request: NextRequest, { params }: { params: { eventId: string } }) {
  const query = request.nextUrl.searchParams;
  const markets = (await getLocalEventMarkets(params.eventId, {
    marketType: query.get('marketType') ?? query.get('market') ?? undefined,
    playerId: query.get('playerId') ?? undefined,
    sportsbook: query.get('sportsbook')?.toUpperCase(),
    minLine: query.has('minLine') ? Number(query.get('minLine')) : undefined,
    maxLine: query.has('maxLine') ? Number(query.get('maxLine')) : undefined,
  })) as unknown as RouteMarket[];
  const events = await listLocalOddsEvents();
  const event = events.find((candidate) => candidate.id === params.eventId);
  const playerIds = [
    ...new Set(markets.map((market) => market.playerId).filter((id): id is string => Boolean(id))),
  ];
  const logs = await getPlayerGameLogs(playerIds);
  const logsByPlayer = new Map(
    playerIds.map((id) => [id, logs.filter((game) => game.playerId === id)]),
  );
  const playerById = new Map(NFL_LEAGUE_DATA.players.map((player) => [player.id, player]));
  const researchByPair = new Map<string, ReturnType<typeof evaluatePropSides>>();
  const pairKey = (market: (typeof markets)[number]) =>
    [
      market.playerId,
      market.marketType,
      market.statId,
      market.period,
      market.line,
      market.isAltLine,
    ].join('|');
  const pairSides = new Map<string, Set<string>>();
  for (const market of markets) {
    const sides = pairSides.get(pairKey(market)) ?? new Set<string>();
    sides.add(market.side);
    pairSides.set(pairKey(market), sides);
  }
  for (const market of markets) {
    if (!market.playerId || market.line === null || !['OVER', 'UNDER'].includes(market.side))
      continue;
    const key = pairKey(market);
    if (
      researchByPair.has(key) ||
      !pairSides.get(key)?.has('OVER') ||
      !pairSides.get(key)?.has('UNDER')
    )
      continue;
    const opponent = event
      ? market.teamId === event.homeTeamId
        ? event.awayTeamId
        : market.teamId === event.awayTeamId
          ? event.homeTeamId
          : undefined
      : undefined;
    researchByPair.set(
      key,
      evaluatePropSides(market, logsByPlayer.get(market.playerId) ?? [], opponent),
    );
  }
  return NextResponse.json({
    markets: markets.map((market) => {
      const research = researchByPair.get(pairKey(market));
      const summarize = (side: ReturnType<typeof evaluatePropSides>['over']) =>
        side
          ? {
              sampleSize: side.sampleSize,
              positiveSignals: side.positiveSignals.map(({ label, value }) => ({ label, value })),
              concerns: side.concerns.map(({ label, value }) => ({ label, value })),
            }
          : null;
      return {
        ...market,
        headshotUrl: market.playerId ? (playerById.get(market.playerId)?.headshotUrl ?? null) : null,
        researchStatus: (() => {
          const statType =
            normalizeHistoricalStatType(market.marketType) ??
            normalizeHistoricalStatType(market.statId);
          if (!statType || !market.playerId) return 'NONE';
          const sample = (logsByPlayer.get(market.playerId) ?? []).filter(
            (game) => resolveHistoricalStat(game, statType) !== null,
          ).length;
          return sample >= 5 ? 'FULL' : sample > 0 ? 'PARTIAL' : 'NONE';
        })(),
        labResearch: research
          ? {
              labFindSide: research.labFindSide,
              over: summarize(research.over),
              under: summarize(research.under),
            }
          : null,
      };
    }),
  });
}
