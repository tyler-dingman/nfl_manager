import { loadEnvConfig } from '@next/env';

const valueAfter = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  loadEnvConfig(process.cwd());
  const group = valueAfter('--group');
  if (group !== 'standard' && group !== 'video') {
    throw new Error('Usage: npm run content:ingest -- --group standard|video [--team KC]');
  }
  const teamId = valueAfter('--team')?.trim().toUpperCase();
  const [{ GroundedDeterministicStorySynthesizer }, monitoring, video, engine, automation] =
    await Promise.all([
      import('../src/features/story-engine/synthesis'),
      import('../src/server/monitoring/observer'),
      import('../src/server/film-room/video-source-sync'),
      import('../src/server/story-engine/service'),
      import('../src/server/content-automation/global-repository'),
    ]);

  const registered = teamId
    ? await monitoring.syncMonitoringRegistry(teamId)
    : await monitoring.syncAllMonitoringRegistries();
  const verifiedVideoSources =
    group === 'video' ? await video.syncVerifiedVideoSources(teamId, false) : null;
  const scheduled = await engine.scheduleDueSources(new Date(), teamId, group);
  const jobs = await engine.drainJobs(
    50,
    teamId,
    true,
    new GroundedDeterministicStorySynthesizer(),
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    10,
    group,
  );
  const failed = jobs.filter((job) => job.type === 'error');
  const generated = jobs.filter((job) =>
    ['created', 'updated', 'published'].includes(String(job.result?.action)),
  ).length;
  await automation.recordGlobalRun({
    status: failed.length ? 'FAILED' : scheduled.queued || jobs.length ? 'COMPLETED' : 'UNCHANGED',
    sourcesDue: scheduled.due,
    sourcesQueued: scheduled.queued,
    jobsProcessed: jobs.length,
    generatedItems: generated,
    failedJobs: failed.length,
    detail: { group, teamId: teamId ?? 'ALL', manual: true },
  });
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        group,
        teamId: teamId ?? 'ALL',
        registeredSources: registered.length,
        verifiedVideoSources,
        scheduled,
        jobsProcessed: jobs.length,
        generated,
        filmRoomOnly: jobs.filter((job) => job.result?.action === 'film-room-only').length,
        failed: failed.map((job) => String(job.error)),
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
