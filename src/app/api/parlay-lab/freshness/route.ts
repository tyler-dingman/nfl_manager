import { NextResponse } from 'next/server';
import { applicationBackend, applicationStorage } from '@/server/persistence/bindings';
import { authDb } from '@/server/auth/database';
import { oddsFreshness } from '../../../../../packages/parlay/freshness';
export const dynamic = 'force-dynamic';
let cached: { expiresAt: number; completedAt: string | null } | undefined;
let pending: Promise<string | null> | undefined;
async function storedPriceTime() {
  if (cached && cached.expiresAt > Date.now()) return cached.completedAt;
  pending ??= (async () => {
    const rows =
      await authDb()`SELECT min(updated_at) AS oldest FROM sportsbook_prices WHERE available=true`;
    return rows[0]?.oldest ? new Date(rows[0].oldest).toISOString() : null;
  })();
  const lookup = pending;
  try {
    const completedAt = await lookup;
    cached = { completedAt, expiresAt: Date.now() + 300000 };
    return completedAt;
  } finally {
    if (pending === lookup) pending = undefined;
  }
}
export async function GET() {
  let completedAt: string | number | null = null,
    coverage = 'UNKNOWN';
  try {
    if (applicationBackend() === 'd1') {
      const s = applicationStorage('D1_SHARED');
      const [row] = await s.rows<any>(
        'SELECT min(as_of) AS completedAt FROM app_sportsbook_events WHERE kickoff_at>? AND markets_hash IS NOT NULL',
        [Date.now()],
      );
      completedAt = row?.completedAt ?? null;
      coverage = completedAt ? 'STORED' : 'UNKNOWN';
    } else {
      completedAt = await storedPriceTime();
    }
  } catch {}
  return NextResponse.json(
    { ...oddsFreshness(completedAt, coverage), completedAt, coverage },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
