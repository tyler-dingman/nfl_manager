import { TEAM_LIST } from '@/data/teams';
import { D1ApplicationSettings } from '../../../../../packages/storage/lifecycle';
import { dateInTimezone } from '@/features/three-and-out/daily';
import {
  applicationBackend,
  applicationStorage,
  applicationDatabaseRouter,
} from '@/server/persistence/bindings';
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
  const briefingDate = request.nextUrl.searchParams.get('date') ?? undefined;
  if (
    briefingDate &&
    (!teamId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(briefingDate) ||
      !Number.isFinite(Date.parse(briefingDate)))
  )
    return NextResponse.json(
      { ok: false, error: 'Explicit team and valid briefing date required' },
      { status: 400 },
    );
  if (!['generate', 'deliver', 'check'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  }
  try {
    if (applicationBackend() === 'd1')
      await applicationStorage('D1_SHARED').rows('SELECT id FROM app_daily_briefings LIMIT 0');
    else await assertDailyThreeAndOutSchema(authDb());
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
      if (applicationDatabaseRouter() && !teamId) {
        const settings = new D1ApplicationSettings(applicationStorage('D1_SHARED')),
          key = 'multi-d1-briefing-generation',
          day = dateInTimezone(new Date(), 'America/Chicago'),
          prior = await settings.read(key);
        const cursor = prior?.value.day === day ? prior.value.cursor : 0;
        if (!Number.isInteger(cursor) || cursor < 0 || cursor > TEAM_LIST.length)
          throw Error('Invalid briefing generation cursor');
        if (cursor === TEAM_LIST.length) return NextResponse.json({ ok: true, action, done: true });
        const target = TEAM_LIST[cursor].abbr,
          result = await generateDailyThreeAndOut(target, { force });
        const advanced = await settings.compareAndSet(key, prior?.version ?? 0, {
          day,
          cursor: cursor + 1,
        });
        return NextResponse.json({
          ok: true,
          action,
          generated: [{ teamId: target, generated: Boolean(result) }],
          done: advanced && cursor + 1 === TEAM_LIST.length,
          nextCursor: cursor + 1,
        });
      }
      const generated = teamId
        ? [
            {
              teamId,
              generated: Boolean(await generateDailyThreeAndOut(teamId, { force, briefingDate })),
            },
          ]
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
