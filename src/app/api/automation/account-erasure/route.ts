import { NextResponse } from 'next/server';
import { automationAuthError } from '@/server/content-automation/auth';
import { applicationDatabaseRouter } from '@/server/persistence/bindings';
import { continueMultiD1Erasure } from '../../../../../packages/storage/account-erasure-multi';
export async function POST(request: Request) {
  const error = automationAuthError(request.headers.get('authorization'));
  if (error) return NextResponse.json({ ok: false, ...error }, { status: error.status });
  const router = applicationDatabaseRouter();
  if (!router) return NextResponse.json({ error: 'Multi-D1 required' }, { status: 503 });
  return NextResponse.json(await continueMultiD1Erasure(router.users()), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
