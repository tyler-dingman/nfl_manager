import { NextResponse } from 'next/server';
import { automationAuthError } from '@/server/content-automation/auth';
import { applicationStorage, applicationEnvironment } from '@/server/persistence/bindings';
import { fetchOddsPage, startOddsFetch } from '../../../../../packages/storage/odds-fetch';
export async function POST(request: Request) {
  const error = automationAuthError(request.headers.get('authorization'));
  if (error) return NextResponse.json({ ok: false, ...error }, { status: error.status });
  const env = applicationEnvironment();
  if (env.APP_ODDS_FETCH_ENABLED !== 'true')
    return NextResponse.json({ ok: true, skipped: true, reason: 'Odds provider capture disabled' });
  const s = applicationStorage('D1_SHARED'),
    action = new URL(request.url).searchParams.get('action') ?? 'fetch';
  if (action === 'start')
    return NextResponse.json({ ok: true, ...(await startOddsFetch(s, new Date())) });
  if (action !== 'fetch')
    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  const result = await fetchOddsPage(s, {
    apiKey: env.SPORTSGAMEODDS_API_KEY ?? '',
    verifiedDailyHttpCeiling: Number(env.ODDS_PROVIDER_DAILY_HTTP_CEILING ?? 0),
  });
  return NextResponse.json({ ok: true, ...result });
}
