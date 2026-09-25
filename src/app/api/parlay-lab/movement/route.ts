import { NextResponse } from 'next/server';
import { authDb } from '@/server/auth/database';
export const dynamic = 'force-dynamic';
// Read existing imported snapshots; no additional provider or ingestion pipeline.
export async function GET() {
  try {
    const rows = await authDb()`
      WITH recent AS (
        SELECT s.market_id, s.sportsbook, s.line, s.odds, s.captured_at,
          lag(s.line) OVER (PARTITION BY s.market_id,s.sportsbook ORDER BY s.captured_at,s.id) AS old_line,
          lag(s.odds) OVER (PARTITION BY s.market_id,s.sportsbook ORDER BY s.captured_at,s.id) AS old_odds
        FROM sportsbook_price_snapshots s
        JOIN bet_markets m ON m.id=s.market_id
        JOIN sportsbook_events e ON e.id=m.event_id
        WHERE e.kickoff_at > now() AND NOT e.markets_locked
          AND s.available AND s.captured_at > now()-interval '7 days'
      ), changes AS (
        SELECT DISTINCT ON (market_id,sportsbook) market_id::text AS "marketId", sportsbook,
          line::float AS "newLine", old_line::float AS "oldLine",
          odds AS "newOdds", old_odds AS "oldOdds", captured_at AS "capturedAt"
        FROM recent
        WHERE (old_line IS NOT NULL AND old_line IS DISTINCT FROM line)
          OR (old_odds IS NOT NULL AND old_odds IS DISTINCT FROM odds)
        ORDER BY market_id,sportsbook,captured_at DESC
      ) SELECT * FROM changes ORDER BY "capturedAt" DESC LIMIT 100
    `;
    return NextResponse.json({ movements: rows });
  } catch {
    return NextResponse.json(
      { movements: [], error: 'Saved movement data is unavailable.' },
      { status: 503 },
    );
  }
}
