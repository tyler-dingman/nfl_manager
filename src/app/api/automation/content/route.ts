import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { drainJobs, scheduleDueSources } from '@/server/story-engine/service';
import { generationStopReason, evaluateTrialWindow } from '@/server/content-automation/trial';
import { readTrialUsage, recordTrialRun } from '@/server/content-automation/repository';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const equalSecret = (actual: string | null, expected?: string) => {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: NextRequest) {
  if (
    !equalSecret(
      request.headers.get('authorization'),
      `Bearer ${process.env.CONTENT_AUTOMATION_SECRET ?? ''}`,
    )
  )
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const manualOverride =
    request.headers.get('x-content-automation-manual') === 'true' &&
    equalSecret(
      request.headers.get('x-content-automation-override'),
      process.env.CONTENT_AUTOMATION_ADMIN_OVERRIDE_SECRET,
    );
  const window = evaluateTrialWindow({
    startsAt: process.env.CONTENT_AUTOMATION_STARTS_AT,
    expiresAt: process.env.CONTENT_AUTOMATION_EXPIRES_AT,
    override: manualOverride,
  });
  if (!window.active) {
    console.log(window.message);
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: window.reason,
      message: window.message,
    });
  }

  const teamId = (process.env.CONTENT_AUTOMATION_TEAM_ID ?? '').trim().toUpperCase();
  if (teamId !== 'KC') {
    console.log('Content automation team scope is missing or is not KC');
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'invalid-team-scope',
      message: 'Content automation team scope is missing or is not KC',
    });
  }

  const requestedTeam = request.nextUrl.searchParams.get('team')?.trim().toUpperCase();
  if (requestedTeam !== teamId)
    return NextResponse.json({ ok: false, error: `team must be ${teamId}` }, { status: 400 });

  const group = request.nextUrl.searchParams.get('group');
  if (group !== 'standard' && group !== 'video')
    return NextResponse.json(
      { ok: false, error: 'group must be standard or video' },
      { status: 400 },
    );

  const usage = await readTrialUsage(window.startsAt, window.expiresAt);
  const stoppedBy = generationStopReason(usage);
  if (stoppedBy) {
    console.log(stoppedBy);
    await recordTrialRun({
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      pollingGroup: group,
      status: 'BUDGET_STOP',
      detail: { stoppedBy, usage },
    });
    return NextResponse.json({ ok: true, skipped: true, stoppedBy, usage });
  }

  const remaining = Math.min(10 - usage.generatedToday, 30 - usage.generatedTotal);
  const scheduled = await scheduleDueSources(new Date(), teamId, group);
  if (scheduled.queued === 0) {
    await recordTrialRun({
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      pollingGroup: group,
      status: 'UNCHANGED',
      detail: { scheduled },
    });
    return NextResponse.json({
      ok: true,
      team: teamId,
      group,
      scheduled,
      jobs: 0,
      generated: 0,
      aiSpendUsd: 0,
    });
  }

  const jobs = await drainJobs(Math.max(1, remaining), teamId);
  const generated = jobs.filter((job) =>
    ['created', 'updated', 'published'].includes(String((job as any).result?.action)),
  ).length;
  await recordTrialRun({
    startsAt: window.startsAt,
    expiresAt: window.expiresAt,
    pollingGroup: group,
    status: 'COMPLETED',
    generatedItems: generated,
    aiSpendUsd: 0,
    detail: { scheduled, jobs: jobs.length },
  });
  return NextResponse.json({
    ok: true,
    team: teamId,
    group,
    scheduled,
    jobs: jobs.length,
    generated,
    aiSpendUsd: 0,
  });
}
