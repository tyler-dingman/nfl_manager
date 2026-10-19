import { applicationBackend, applicationStorage } from '@/server/persistence/bindings';
import { D1OddsBoard } from '../../../../../packages/storage/odds-board';
import { NextResponse } from 'next/server';
import { authDb } from '@/server/auth/database';
export const dynamic = 'force-dynamic';
// Read existing imported snapshots; no additional provider or ingestion pipeline.
export async function GET() {
  try {
    if (applicationBackend() === 'd1') {
      const s = applicationStorage(),
        board = new D1OddsBoard(s),
        events = (await board.events()).filter((e) => !e.marketsLocked),
        movements: any[] = [];
      for (const event of events) {
        const history = (await board.priceHistory(event.id, new Date().toISOString(), true)).filter(
          (p: any) => Date.parse(p.capturedAt ?? p.asOf ?? '') > Date.now() - 7 * 86400000,
        );
        const prior = new Map<string, any>(),
          changes = new Map<string, any>();
        for (const sample of history.sort((a: any, b: any) =>
          String(a.capturedAt ?? a.asOf).localeCompare(String(b.capturedAt ?? b.asOf)),
        )) {
          const key = sample.marketId + ':' + sample.sportsbook,
            old = prior.get(key);
          if (
            old &&
            sample.available &&
            ((old.line != null && old.line !== sample.line) ||
              (old.odds != null && old.odds !== sample.odds))
          )
            changes.set(key, {
              marketId: sample.marketId,
              sportsbook: sample.sportsbook,
              newLine: sample.line,
              oldLine: old.line,
              newOdds: sample.odds,
              oldOdds: old.odds,
              capturedAt: sample.capturedAt ?? sample.asOf,
            });
          prior.set(key, sample);
        }
        movements.push(...changes.values());
      }
      return NextResponse.json({
        movements: movements.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, 100),
      });
    }
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
