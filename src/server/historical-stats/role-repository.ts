import { D1OddsBoard } from '../../../packages/storage/odds-board';
import {
  applicationBackend,
  applicationStorage,
  applicationPublicCacheScope,
} from '../persistence/bindings';
import { ReferenceData } from '../../../packages/storage/reference';
import { authDb } from '@/server/auth/database';
import { cachePublicRead } from '@/server/cache/public-read-cache';
import type { RoleContext, RoleObservation } from '../../../packages/parlay/role-evidence';

export const getRoleEvidence = cachePublicRead(
  async (
    teamIds: string[],
    asOf: string,
  ): Promise<Pick<RoleContext, 'observations' | 'coverageAt'>> => {
    if (!teamIds.length) return { observations: [], coverageAt: null };
    if (applicationBackend() === 'd1')
      return new ReferenceData(applicationStorage()).roles(teamIds, asOf);
    try {
      const db = authDb();
      const [rows, runs] = await Promise.all([
        db<{ evidence: RoleObservation; receivedAt: string }[]>`
        SELECT evidence, received_at::text AS "receivedAt" FROM parlay_role_observations
        WHERE team_id=ANY(${teamIds}) AND source_at <= ${asOf}::timestamptz AND received_at <= ${asOf}::timestamptz
          AND source_at > ${asOf}::timestamptz - interval '21 days' ORDER BY source_at DESC`,
        db<{ sourceAt: string }[]>`SELECT source_at::text AS "sourceAt" FROM parlay_role_feed_runs
        WHERE complete AND source_at <= ${asOf}::timestamptz AND received_at <= ${asOf}::timestamptz
          AND diagnostics->'teamIds' @> ${db.json(teamIds)}::jsonb
        ORDER BY source_at DESC LIMIT 1`,
      ]);
      return {
        observations: rows.map((r) => ({ ...r.evidence, receivedAt: r.receivedAt })),
        coverageAt: runs[0]?.sourceAt ?? null,
      };
    } catch (error) {
      // Rolling deployment before migration: explicitly missing evidence, never assumed healthy.
      if ((error as { code?: string }).code === '42P01')
        return { observations: [], coverageAt: null };
      throw error;
    }
  },
  { scope: applicationPublicCacheScope },
);

export const getTeamResearchPlayerIds = cachePublicRead(
  async (teamIds: string[]) => {
    if (!teamIds.length) return [];
    if (applicationBackend() === 'd1')
      return new ReferenceData(applicationStorage()).researchPlayers(teamIds);
    const rows = await authDb()<
      { playerId: string }[]
    >`SELECT DISTINCT player_id AS "playerId" FROM historical_player_games
    WHERE team_id=ANY(${teamIds}) AND player_id IS NOT NULL AND position IN ('QB','RB','WR','TE')
      AND season >= extract(year FROM now())::int - 1`;
    return rows.map((r) => r.playerId);
  },
  { scope: applicationPublicCacheScope },
);

export const getEventPriceHistory = cachePublicRead(
  async (eventId: string, asOf: string) =>
    applicationBackend() === 'd1'
      ? new D1OddsBoard(applicationStorage()).priceHistory(eventId, asOf)
      : authDb()<
          {
            playerId: string;
            marketType: string;
            side: string;
            sportsbook: string;
            line: number;
            odds: number | null;
            capturedAt: string;
          }[]
        >`SELECT m.player_id AS "playerId",m.market_type AS "marketType",m.side,s.sportsbook,
    s.line::float8 AS line,s.odds,s.captured_at::text AS "capturedAt"
    FROM sportsbook_price_snapshots s JOIN bet_markets m ON m.id=s.market_id
    WHERE m.event_id=${eventId} AND m.period='game' AND m.is_alt_line=false AND s.available
      AND s.line IS NOT NULL AND s.captured_at <= ${asOf}::timestamptz
    ORDER BY s.captured_at ASC`,
  { scope: applicationPublicCacheScope },
);

export function marketMovement(
  rows: ReadonlyArray<Awaited<ReturnType<typeof getEventPriceHistory>>[number]>,
  market: {
    playerId: string | null;
    marketType: string;
    side: string;
    sportsbook: string;
    line: number | null;
    odds: number | null;
  },
) {
  const matching = rows.filter(
    (r) =>
      r.playerId === market.playerId &&
      r.marketType === market.marketType &&
      r.side === market.side,
  );
  const own = matching.filter((r) => r.sportsbook === market.sportsbook);
  const books = new Map<string, number>();
  for (const r of matching) books.set(r.sportsbook, r.line);
  const lines = [...books.values()].sort((a, b) => a - b);
  return {
    openingLine: own[0]?.line ?? null,
    currentLine: market.line == null ? 0.5 : Number(market.line),
    consensusLine: lines.length
      ? (lines[Math.floor((lines.length - 1) / 2)]! + lines[Math.floor(lines.length / 2)]!) / 2
      : null,
    openingOdds: own[0]?.odds ?? null,
    currentOdds: market.odds,
    observedAt: own.at(-1)?.capturedAt ?? null,
  };
}
