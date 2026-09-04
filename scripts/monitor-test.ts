import { loadEnvConfig } from '@next/env';

const value = (name: string, fallback: string) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? fallback;
async function main() {
  loadEnvConfig(process.cwd());
  process.env.OBSERVER_MODE = 'true';

  const teamId = value('team', 'KC').toUpperCase();
  const hours = Number(value('hours', '24'));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168)
    throw new Error('--hours must be between 0 and 168.');

  const { scheduleDueSources, drainJobs } = await import('../src/server/story-engine/service');
  const {
    startObserverRun,
    captureObserverSnapshot,
    completeObserverRun,
    observerReport,
    syncMonitoringRegistry,
  } = await import('../src/server/monitoring/observer');

  await syncMonitoringRegistry(teamId);
  const run = await startObserverRun(teamId, hours);
  console.log(
    `Observer run ${run.id} started for ${teamId}; scheduled end ${run.scheduledEndAt.toISOString()}`,
  );
  let stopping = false;
  process.once('SIGINT', () => {
    stopping = true;
  });
  try {
    while (!stopping && Date.now() < run.scheduledEndAt.getTime()) {
      const scheduled = await scheduleDueSources(new Date(), teamId);
      const jobs = await drainJobs(250);
      const captured = await captureObserverSnapshot(run.id);
      console.log(
        JSON.stringify({ at: new Date().toISOString(), scheduled, jobs: jobs.length, ...captured }),
      );
      const remainingMs = run.scheduledEndAt.getTime() - Date.now();
      if (remainingMs > 0)
        await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, remainingMs)));
    }
    await completeObserverRun(run.id, 'COMPLETED');
    console.log(JSON.stringify(await observerReport(run.id), null, 2));
  } catch (error) {
    await completeObserverRun(
      run.id,
      'FAILED',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
