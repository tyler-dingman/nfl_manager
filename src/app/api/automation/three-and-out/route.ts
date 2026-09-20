import { NextRequest, NextResponse } from 'next/server';
import { automationAuthError } from '@/server/content-automation/auth';

import {
  deliverDueDailyThreeAndOut,
  generateAllDailyThreeAndOut,
  generateDailyThreeAndOut,
} from '@/server/three-and-out/daily-service';
import { authDb } from '@/server/auth/database';
import {
  assertDailyThreeAndOutSchema,
  DailySchemaNotReadyError,
} from '@/server/three-and-out/schema';
import { localHourAndMinute } from '@/features/three-and-out/daily';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authError = automationAuthError(request.headers.get('authorization'));
  if (authError)
    return NextResponse.json(
      { ok: false, code: authError.code, error: authError.error },
      { status: authError.status },
    );
  const action = request.nextUrl.searchParams.get('action') ?? 'run';
  const teamId = request.nextUrl.searchParams.get('team')?.toUpperCase();
  const force = request.nextUrl.searchParams.get('force') === 'true';
  if (!['generate', 'deliver', 'check'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  }
  try {
    await assertDailyThreeAndOutSchema(authDb());
    if (action === 'check') return NextResponse.json({ ok: true, action, schemaReady: true });
    if (action === 'generate') {
      const chicago = localHourAndMinute(new Date(), 'America/Chicago');
      if (
        !teamId &&
        !force &&
        (chicago.hour !== 16 || chicago.minute < 30 || chicago.minute > 50)
      ) {
        return NextResponse.json({
          ok: true,
          action,
          skipped: true,
          reason: 'Outside the 4:30–4:50 PM Central generation window.',
        });
      }
      const generated = teamId
        ? [{ teamId, generated: Boolean(await generateDailyThreeAndOut(teamId, { force })) }]
        : await generateAllDailyThreeAndOut({ force });
      return NextResponse.json({ ok: true, action, generated });
    }
    if (action === 'deliver') {
      return NextResponse.json({ ok: true, action, delivery: await deliverDueDailyThreeAndOut() });
    }
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof DailySchemaNotReadyError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    console.error('[three-and-out-automation]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Automation failed' },
      { status: 500 },
    );
  }
}
