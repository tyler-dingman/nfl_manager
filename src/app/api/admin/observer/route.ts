import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getMonitoringSources } from '@/data/sources/monitoring';
import { MONITORING_THRESHOLDS } from '@/features/monitoring/config';
import { isAllowedAdminUser } from '@/server/admin/authorization';
import { currentUser } from '@/server/auth/request';
import { authDb } from '@/server/auth/database';
import { observerReport } from '@/server/monitoring/observer';

async function allowed(request: NextRequest) {
  const user = await currentUser(request);
  return isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? '');
}

export async function GET(request: NextRequest) {
  if (!(await allowed(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const params = request.nextUrl.searchParams;
  const teamId = (params.get('team') ?? 'KC').toUpperCase();
  let runId = params.get('run');
  if (!runId) {
    const [latest] =
      await authDb()`SELECT id FROM observer_runs WHERE team_id=${teamId} ORDER BY started_at DESC LIMIT 1`;
    runId = latest?.id ?? null;
  }
  return NextResponse.json({
    registry: getMonitoringSources(teamId),
    report: runId ? await observerReport(runId) : null,
  });
}

const replaySchema = z.object({
  runId: z.string().uuid(),
  thresholds: z
    .object({
      indexOnlyMax: z.number().min(0).max(100),
      feedOnlyMax: z.number().min(0).max(100),
      candidateNotificationMin: z.number().min(0).max(100),
      pushNotificationMin: z.number().min(0).max(120),
      breakingNotificationMin: z.number().min(0).max(120),
    })
    .default(MONITORING_THRESHOLDS),
});

export async function POST(request: NextRequest) {
  if (!(await allowed(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = replaySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid replay thresholds.' }, { status: 400 });
  return NextResponse.json({
    report: await observerReport(parsed.data.runId, parsed.data.thresholds),
  });
}
