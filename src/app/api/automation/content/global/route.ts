import { automationAuthError } from '@/server/content-automation/auth';
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
import { syncAllMonitoringRegistries, syncMonitoringRegistry } from '@/server/monitoring/observer';
import { drainJobs, scheduleDueSources } from '@/server/story-engine/service';
import { syncVerifiedVideoSources } from '@/server/film-room/video-source-sync';
import { storyById } from '@/server/story-engine/repository';
import { generateDailyThreeAndOut } from '@/server/three-and-out/daily-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const safeJobFailure = (value: unknown) => {
  const message = String(value ?? '');
  const http = message.match(/Source fetch failed with HTTP (\d+)/i)?.[1];
  if (http) return `source-http:${http}`;
  if (/abort|timed? out/i.test(message)) return 'source-timeout';
  if (/does not exist/i.test(message)) return 'database-schema';
  return 'job-processing-error';
};

export async function POST(request: NextRequest) {
  const authError = automationAuthError(request.headers.get('authorization'));
  if (authError)
    return NextResponse.json({ ok: false, ...authError }, { status: authError.status });

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
  const forceRequested = request.nextUrl.searchParams.get('force') === 'true';
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
  const verifiedVideoSources =
    requestedGroup === 'standard'
      ? { skipped: true, reason: 'standard-only run' }
      : await syncVerifiedVideoSources(requestedTeam, forceRequested);
  const scheduled = requestedTeam
    ? await scheduleDueSources(
        new Date(),
        requestedTeam,
        requestedGroup as 'standard' | 'video' | undefined,
      )
    : await scheduleDueSources(
        new Date(),
        undefined,
        requestedGroup as 'standard' | 'video' | undefined,
      );
  const jobs = await drainJobs(
    50,
    requestedTeam,
    true,
    new GroundedDeterministicStorySynthesizer(),
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    remaining,
    requestedGroup as 'standard' | 'video' | undefined,
  );
  const generated = jobs.filter((job) =>
    ['created', 'updated', 'published'].includes(String((job as any).result?.action)),
  ).length;
  const changedStoryIds = jobs.flatMap((job) => {
    const action = String((job as any).result?.action);
    const storyId = (job as any).result?.storyId;
    return storyId && ['created', 'updated', 'published'].includes(action) ? [String(storyId)] : [];
  });
  const changedTeams = new Set<string>();
  for (const storyId of changedStoryIds) {
    const story = await storyById(storyId);
    if (story?.teamId) changedTeams.add(story.teamId);
  }
  const regeneratedThreeAndOut = [];
  for (const teamId of changedTeams) {
    try {
      regeneratedThreeAndOut.push({
        teamId,
        generated: Boolean(await generateDailyThreeAndOut(teamId, { force: true })),
      });
    } catch (error) {
      regeneratedThreeAndOut.push({
        teamId,
        generated: false,
        error: error instanceof Error ? error.message : 'generation failed',
      });
    }
  }
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
      verifiedVideoSources,
      configuredTeams: requestedTeam ? [requestedTeam] : configuredTeamIds,
      failedJobReasons,
      regeneratedThreeAndOut,
    },
  });

  return NextResponse.json({
    ok: true,
    status,
    configuredTeams: requestedTeam ? [requestedTeam] : configuredTeamIds,
    registeredSources: registered.length,
    verifiedVideoSources,
    scheduled,
    jobs: jobs.length,
    failedJobs: failedJobs.length,
    failedJobReasons,
    generated,
    regeneratedThreeAndOut,
    generatedToday: generatedToday + generated,
    aiSpendUsd: 0,
  });
}

// Read-only authentication check: no database access or ingestion side effects.
export async function GET(request: NextRequest) {
  const authError = automationAuthError(request.headers.get('authorization'));
  if (authError)
    return NextResponse.json(
      { ok: false, ...authError },
      { status: authError.status, headers: { 'Cache-Control': 'no-store' } },
    );
  return NextResponse.json(
    { ok: true, service: 'content-automation', authenticated: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
