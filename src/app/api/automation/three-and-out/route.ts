import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  deliverDueDailyThreeAndOut,
  generateAllDailyThreeAndOut,
  generateDailyThreeAndOut,
} from '@/server/three-and-out/daily-service';
import { localHourAndMinute } from '@/features/three-and-out/daily';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const authorized = (request: NextRequest) => {
  const expected = `Bearer ${process.env.CONTENT_AUTOMATION_SECRET ?? ''}`;
  const actual = request.headers.get('authorization') ?? '';
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return (
    Boolean(process.env.CONTENT_AUTOMATION_SECRET) &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
};

export async function POST(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const action = request.nextUrl.searchParams.get('action') ?? 'run';
  const teamId = request.nextUrl.searchParams.get('team')?.toUpperCase();
  const force = request.nextUrl.searchParams.get('force') === 'true';
  try {
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
    console.error('[three-and-out-automation]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Automation failed' },
      { status: 500 },
    );
  }
}
