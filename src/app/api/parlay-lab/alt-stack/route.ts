import { NextResponse } from 'next/server';
import { listLocalOddsEvents } from '@/server/odds/repository';
import { getCatalogEventResearch } from '@/server/odds/prop-catalog';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const events = await listLocalOddsEvents();
    const markets = [];
    // Bound concurrent database work; reuse actual threshold-specific historical research.
    for (let i = 0; i < events.length; i += 3) {
      const batch = await Promise.all(
        events.slice(i, i + 3).map(async (e) => {
          const rows = await getCatalogEventResearch(e.id, 'alternate');
          return rows
            .filter((m) => m.lineType === 'alternate' && m.mainLine != null && m.side === 'OVER')
            .map((m) => ({ ...m, eventId: e.id }));
        }),
      );
      markets.push(...batch.flat());
    }
    return NextResponse.json({ events, markets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Alt-line prices and historical research are unavailable. Please try again later.' },
      { status: 503 },
    );
  }
}
