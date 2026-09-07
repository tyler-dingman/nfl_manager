import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { drainJobs, scheduleDueSources } from '@/server/story-engine/service';
import { generationStopReason, evaluateTrialWindow } from '@/server/content-automation/trial';
import { readTrialUsage, recordTrialRun } from '@/server/content-automation/repository';
import { syncMonitoringRegistry } from '@/server/monitoring/observer';
import { GroundedDeterministicStorySynthesizer } from '@/features/story-engine/synthesis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const equalSecret = (actual: string | null, expected?: string) => {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

const safeJobFailure = (value: unknown) => {
  const message = String(value ?? '');
  const column = message.match(/column ["']?([a-z0-9_]+)["']? .*does not exist/i)?.[1];
  if (column) return `missing-column:${column}`;
  const relation = message.match(/relation ["']?([a-z0-9_]+)["']? does not exist/i)?.[1];
  if (relation) return `missing-relation:${relation}`;
  const constraint = message.match(/constraint ["']?([a-z0-9_]+)["']?/i)?.[1];
  if (constraint) return `database-constraint:${constraint}`;
  const http = message.match(/Source fetch failed with HTTP (\d+)/i)?.[1];
  if (http) return `source-http:${http}`;
  if (/abort|timed? out/i.test(message)) return 'source-timeout';
  if (/ollama|ECONNREFUSED|fetch failed/i.test(message)) return 'provider-unavailable';
  return 'job-processing-error';
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
  // Production databases are intentionally not seeded during deployment. Keep the
  // code-defined registry authoritative so a fresh database cannot silently report
  // zero due sources while publishers have new items.
  try {
    await syncMonitoringRegistry(teamId);
  } catch (error) {
    console.error('[content-automation] source registry sync failed', error);
    return NextResponse.json(
      { ok: false, error: 'source-registry-sync-failed' },
      { status: 500 },
    );
  }
  let scheduled;
  try {
    scheduled = await scheduleDueSources(new Date(), teamId, group);
  } catch (error) {
    console.error('[content-automation] source scheduling failed', error);
    return NextResponse.json(
      { ok: false, error: 'source-scheduling-failed' },
      { status: 500 },
    );
  }
  // A single unavailable publisher must not prevent the remaining registered
  // sources from being checked during this scheduled batch. Drain previously
  // queued candidates even when no feed is due on this particular invocation.
  const jobs = await drainJobs(
    Math.max(1, remaining),
    teamId,
    true,
    new GroundedDeterministicStorySynthesizer(),
  );
  const generated = jobs.filter((job) =>
    ['created', 'updated', 'published'].includes(String((job as any).result?.action)),
  ).length;
  const failedJobReasons = [
    ...new Set(
      jobs.filter((job) => job.type === 'error').map((job) => safeJobFailure(job.error)),
    ),
  ];
  if (scheduled.queued === 0 && jobs.length === 0) {
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
    failedJobs: jobs.filter((job) => job.type === 'error').length,
    failedJobReasons,
    generated,
    aiSpendUsd: 0,
  });
}
