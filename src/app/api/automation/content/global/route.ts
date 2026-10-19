import {
  verifiedVideoSourceCount,
  syncVerifiedVideoSourceAt,
} from '@/server/film-room/video-source-sync';
import { advanceEditorialHandoff } from '../../../../../../packages/storage/editorial-handoffs';
import { EDITORIAL_OWNERS } from '../../../../../../packages/storage/editorial-directory';
import { dispatchEditorial } from '../../../../../../packages/storage/editorial-dispatch';
import { teamDatabase, type DatabaseOwner } from '../../../../../../packages/storage/multi-d1';
import {
  applicationBackend,
  applicationStorage,
  applicationDatabaseRouter,
  currentEditorialOwner,
  withEditorialOwner,
} from '@/server/persistence/bindings';
import { PollingBatches } from '../../../../../../packages/storage/polling-batches';
import { workOne } from '@/server/story-engine/service';
import { automationAuthError } from '@/server/content-automation/auth';
import { NextRequest, NextResponse } from 'next/server';

import { getAllMonitoringSources, getMonitoringTeamIds } from '@/data/sources/monitoring';
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
  syncMonitoringSource,
} from '@/server/monitoring/observer';
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

export async function POST(request: NextRequest): Promise<Response> {
  const authError = automationAuthError(request.headers.get('authorization'));
  if (authError)
    return NextResponse.json({ ok: false, ...authError }, { status: authError.status });

  const router = applicationDatabaseRouter();
  if (router && !currentEditorialOwner()) {
    const selected = request.nextUrl.searchParams.get('owner');
    if (request.nextUrl.searchParams.get('action') === 'checkpoint') {
      const owner = selected as DatabaseOwner,
        action = request.nextUrl.searchParams.get('resume');
      const batch = request.nextUrl.searchParams.get('batch');
      if (
        !EDITORIAL_OWNERS.includes(owner) ||
        !['poll', 'candidate', 'dispatch', 'handoff'].includes(action ?? '') ||
        (batch && !/^[a-f0-9-]{36}$/.test(batch))
      )
        return NextResponse.json({ ok: false }, { status: 400 });
      const [prior] = await router
        .shared()
        .rows<any>('SELECT owner,action,batch FROM app_editorial_scheduler WHERE id=1');
      if (prior?.owner === owner && prior.action === action && prior.batch === batch)
        return NextResponse.json({ ok: true, unchanged: true });
      await router
        .shared()
        .statement(
          'INSERT INTO app_editorial_scheduler(id,owner,action,batch) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,action=excluded.action,batch=excluded.batch',
          [owner, action, batch],
        )
        .run();
      return NextResponse.json({ ok: true });
    }
    const requested = request.nextUrl.searchParams.get('team')?.trim().toUpperCase();
    let owner: DatabaseOwner;
    let effective = request;
    try {
      if (!selected && !requested && request.nextUrl.searchParams.get('action') !== 'registry') {
        const [saved] = await router
          .shared()
          .rows<any>('SELECT owner,action,batch FROM app_editorial_scheduler WHERE id=1');
        owner = saved?.owner ?? 'D1_TEAM_1';
        if (saved) {
          if (
            !EDITORIAL_OWNERS.includes(saved.owner) ||
            !['poll', 'candidate', 'dispatch', 'handoff'].includes(saved.action)
          )
            throw Error('Corrupt scheduler cursor');
          return NextResponse.json({
            ok: true,
            owner: saved.owner,
            batch: saved.batch,
            nextAction: saved.action,
            resumed: true,
          });
        }
      } else
        owner = (selected as DatabaseOwner) || (requested ? teamDatabase(requested) : 'D1_TEAM_1');
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid owner/team' }, { status: 400 });
    }
    if (!EDITORIAL_OWNERS.includes(owner))
      return NextResponse.json({ ok: false, error: 'Invalid editorial owner' }, { status: 400 });
    const response = await withEditorialOwner(owner, () => POST(effective));
    if (response.status !== 200) return response;
    const body = await response.json();
    return NextResponse.json({
      ...body,
      owner,
      nextOwner: EDITORIAL_OWNERS[EDITORIAL_OWNERS.indexOf(owner) + 1] ?? null,
    });
  }
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

  // D1 uses explicit bounded continuations. Registry reconciliation is an owner
  // preparation step, not an all-source mutation on every scheduler request.
  if (applicationBackend() === 'd1') {
    const batches = new PollingBatches(applicationStorage());
    const action = request.nextUrl.searchParams.get('action') ?? 'poll';
    if (action === 'video-registry') {
      const cursor = Number(request.nextUrl.searchParams.get('cursor') ?? 0);
      if (!Number.isInteger(cursor) || cursor < 0 || cursor >= verifiedVideoSourceCount())
        return NextResponse.json({ ok: false, error: 'Invalid registry cursor' }, { status: 400 });
      await syncVerifiedVideoSourceAt(cursor);
      return NextResponse.json({
        ok: true,
        done: cursor + 1 === verifiedVideoSourceCount(),
        nextCursor: cursor + 1 < verifiedVideoSourceCount() ? cursor + 1 : null,
      });
    }
    if (action === 'registry') {
      const definitions = getAllMonitoringSources();
      const cursor = Number(request.nextUrl.searchParams.get('cursor') ?? 0);
      if (!Number.isInteger(cursor) || cursor < 0 || cursor >= definitions.length)
        return NextResponse.json({ ok: false, error: 'Invalid registry cursor' }, { status: 400 });
      await syncMonitoringSource(definitions[cursor].id);
      return NextResponse.json({
        ok: true,
        sourceId: definitions[cursor].id,
        nextCursor: cursor + 1 < definitions.length ? cursor + 1 : null,
        done: cursor + 1 === definitions.length,
      });
    }
    if (action === 'handoff' && router) {
      const result = await advanceEditorialHandoff(router, currentEditorialOwner()!);
      return NextResponse.json({
        ok: true,
        ...result,
        nextAction: result.done ? 'poll' : 'handoff',
      });
    }
    if (action === 'dispatch' && router) {
      const result = await dispatchEditorial(router, currentEditorialOwner()!);
      return NextResponse.json({
        ok: true,
        ...result,
        nextAction: result.done ? 'candidate' : 'dispatch',
      });
    }
    if (action !== 'poll' && action !== 'candidate')
      return NextResponse.json(
        { ok: false, error: 'Unknown continuation action' },
        { status: 400 },
      );
    if (action === 'candidate') {
      const generatedToday = await readGlobalGeneratedToday();
      if (generatedToday >= config.maxGeneratedPerDay)
        return NextResponse.json({ ok: true, skipped: true, stoppedBy: 'daily-budget' });
      const job = await workOne(
        'bounded-automation',
        requestedTeam,
        new GroundedDeterministicStorySynthesizer(),
        undefined,
        requestedGroup as any,
      );
      const generated = ['created', 'updated', 'published'].includes(
        String((job as any)?.result?.action),
      )
        ? 1
        : 0;
      if (job)
        await recordGlobalRun({ status: 'COMPLETED', jobsProcessed: 1, generatedItems: generated });
      return NextResponse.json({
        ok: true,
        job,
        nextAction: router ? (job ? 'dispatch' : 'handoff') : job ? 'candidate' : 'poll',
      });
    }
    let token = request.nextUrl.searchParams.get('batch');
    if (!token) token = (await batches.claim(requestedTeam, requestedGroup as any))?.token ?? null;
    if (!token && router) {
      const [pending] = await applicationStorage().rows<{ pending: number }>(
        `SELECT EXISTS(SELECT 1 FROM app_editorial_dispatch WHERE done=0) OR EXISTS(SELECT 1 FROM app_briefing_mail_jobs WHERE status='READY') OR EXISTS(SELECT 1 FROM app_editorial_jobs WHERE status IN('PENDING','RETRY','RUNNING')) OR EXISTS(SELECT 1 FROM app_editorial_handoffs WHERE status<>'DONE') AS pending`,
      );
      if (!pending.pending)
        return NextResponse.json({
          ok: true,
          done: true,
          busyOrNoDueSources: true,
          ownerIdle: true,
          nextAction: 'poll',
        });
    }
    if (!token)
      return NextResponse.json({
        ok: true,
        done: true,
        busyOrNoDueSources: true,
        nextAction: router ? 'dispatch' : 'candidate',
      });
    let result;
    try {
      result = await batches.step(token);
    } catch (error) {
      if (!router || !String(error).includes('Polling lease expired or replaced')) throw error;
      token = (await batches.claim(requestedTeam, requestedGroup as any))?.token ?? null;
      if (!token)
        return NextResponse.json({
          ok: true,
          done: true,
          busyOrNoDueSources: true,
          nextAction: router ? 'dispatch' : 'candidate',
        });
      result = await batches.step(token);
    }
    return NextResponse.json({
      ok: true,
      ...result,
      batch: result.done ? null : token,
      nextAction: 'poll',
    });
  }

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
