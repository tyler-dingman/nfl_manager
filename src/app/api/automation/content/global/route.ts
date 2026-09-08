import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getMonitoringTeamIds } from '@/data/sources/monitoring';
import { GroundedDeterministicStorySynthesizer } from '@/features/story-engine/synthesis';
import {
  globalAutomationConfig,
  globalGenerationStopReason,
} from '@/server/content-automation/global';
import {
  readGlobalGeneratedToday,
  recordGlobalRun,
} from '@/server/content-automation/global-repository';
import {
  syncAllMonitoringRegistries,
  syncMonitoringRegistry,
} from '@/server/monitoring/observer';
import { drainJobs, scheduleDueSources } from '@/server/story-engine/service';

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
  const http = message.match(/Source fetch failed with HTTP (\d+)/i)?.[1];
  if (http) return `source-http:${http}`;
  if (/abort|timed? out/i.test(message)) return 'source-timeout';
  if (/does not exist/i.test(message)) return 'database-schema';
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

  const config = globalAutomationConfig();
  const disabled = globalGenerationStopReason({
    enabled: config.enabled,
    generatedToday: 0,
    maxGeneratedPerDay: config.maxGeneratedPerDay,
  });
  if (disabled) {
    console.log(disabled);
    return NextResponse.json({ ok: true, skipped: true, stoppedBy: disabled });
  }

  const requestedTeam = request.nextUrl.searchParams.get('team')?.trim().toUpperCase();
  const requestedGroup = request.nextUrl.searchParams.get('group')?.trim().toLowerCase();
  const configuredTeamIds = getMonitoringTeamIds();
  if (requestedTeam && !configuredTeamIds.includes(requestedTeam))
    return NextResponse.json({ ok: false, error: 'Unknown team' }, { status: 400 });
  if (requestedGroup && requestedGroup !== 'standard' && requestedGroup !== 'video')
    return NextResponse.json(
      { ok: false, error: 'group must be standard or video' },
      { status: 400 },
    );

  const generatedToday = await readGlobalGeneratedToday();
  const stoppedBy = globalGenerationStopReason({
    enabled: config.enabled,
    generatedToday,
    maxGeneratedPerDay: config.maxGeneratedPerDay,
  });
  if (stoppedBy) {
    console.log(stoppedBy);
    await recordGlobalRun({ status: 'BUDGET_STOP', detail: { stoppedBy, generatedToday } });
    return NextResponse.json({ ok: true, skipped: true, stoppedBy, generatedToday });
  }

  const remaining = Math.min(config.maxGeneratedPerRun, config.maxGeneratedPerDay - generatedToday);
  const registered = requestedTeam
    ? await syncMonitoringRegistry(requestedTeam)
    : await syncAllMonitoringRegistries();
  const scheduled = requestedTeam
    ? await scheduleDueSources(
        new Date(),
        requestedTeam,
        requestedGroup as 'standard' | 'video' | undefined,
      )
    : await scheduleDueSources(new Date());
  const jobs = await drainJobs(
    50,
    requestedTeam,
    true,
    new GroundedDeterministicStorySynthesizer(),
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    remaining,
  );
  const generated = jobs.filter((job) =>
    ['created', 'updated', 'published'].includes(String((job as any).result?.action)),
  ).length;
  const failedJobs = jobs.filter((job) => job.type === 'error');
  const failedJobReasons = [...new Set(failedJobs.map((job) => safeJobFailure(job.error)))];
  const status = scheduled.queued === 0 && jobs.length === 0 ? 'UNCHANGED' : 'COMPLETED';

  await recordGlobalRun({
    status,
    sourcesDue: scheduled.due,
    sourcesQueued: scheduled.queued,
    jobsProcessed: jobs.length,
    generatedItems: generated,
    failedJobs: failedJobs.length,
    detail: {
      registeredSources: registered.length,
      configuredTeams: requestedTeam ? [requestedTeam] : configuredTeamIds,
      failedJobReasons,
    },
  });

  return NextResponse.json({
    ok: true,
    status,
    configuredTeams: requestedTeam ? [requestedTeam] : configuredTeamIds,
    registeredSources: registered.length,
    scheduled,
    jobs: jobs.length,
    failedJobs: failedJobs.length,
    failedJobReasons,
    generated,
    generatedToday: generatedToday + generated,
    aiSpendUsd: 0,
  });
}
