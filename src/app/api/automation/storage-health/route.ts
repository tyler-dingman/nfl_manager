import { NextResponse } from 'next/server';
import { automationAuthError } from '@/server/content-automation/auth';
import { applicationDatabaseRouter } from '@/server/persistence/bindings';
import {
  collectCapacity,
  capacityStatus,
  MAPPING_VERSION,
} from '../../../../../packages/storage/multi-d1';
/** Private operator health. Account usage must come from analytics; never infer it as zero. */
export async function GET(request: Request) {
  const error = automationAuthError(request.headers.get('authorization'));
  if (error) return NextResponse.json({ ok: false, ...error }, { status: error.status });
  const router = applicationDatabaseRouter();
  if (!router)
    return NextResponse.json(
      { ok: false, error: 'Multi-D1 configuration required' },
      { status: 503 },
    );
  const samples = await collectCapacity(router.monitoringBindings());
  const databases = capacityStatus(samples, { reads: 0, writes: 0 }).databases;
  return NextResponse.json(
    {
      ok: true,
      mappingVersion: MAPPING_VERSION,
      databases,
      totalStorageBytes: samples.reduce((n, s) => n + s.bytes, 0),
      accountDailyOperations: 'UNVERIFIED: obtain account-wide Cloudflare analytics',
      storageAdmissible: databases.every((d) => d.level !== 'LIMIT' && d.payloadBytes < 64_000_000),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
