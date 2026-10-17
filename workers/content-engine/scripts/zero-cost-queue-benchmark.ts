import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
import { LeanEditorial, LeanR2Objects } from '../src/lean-editorial';
import { handoffSyntheticJob } from '../test/synthetic-lean-handoff';
import { NOW } from '../test/fixtures';
const h = await harness();
try {
  const start = h.db.measurements.length;
  for (let i = 0; i < 50; i++)
    await h.jobs.enqueue({
      id: `job-${i}`,
      jobType: 'SYNTHETIC',
      idempotencyKey: `once-${i}`,
      availableAt: NOW,
      ownerEpoch: 1,
      payload: { synthetic: true },
    });
  for (let i = 0; i < 50; i++) {
    const job = await h.jobs.claim(NOW + 1, 30000);
    if (!job) throw Error('Missing queued job');
    await h.jobs.complete(job, NOW + 2);
  }
  const meters = h.db.measurements.slice(start);
  const store = new LeanEditorial(
    h.db,
    new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    'A',
  );
  const handoffStart = h.db.measurements.length;
  for (let i = 0; i < 50; i++) await handoffSyntheticJob(h, store, `job-${i}`);
  const deletion = h.db.measurements
    .slice(handoffStart)
    .filter((m) => m.label === 'lean.handoff.commit');
  const result = {
    scope:
      '50 actual existing queue enqueue/claim/complete lifecycles; extrapolated to 1400/day, excludes terminal archival and original domain writes already replaced by lean comparison. No queue behavior changed.',
    sampleJobs: 50,
    rowsRead: meters.reduce((n, m) => n + m.rowsRead, 0),
    rowsWritten: meters.reduce((n, m) => n + m.rowsWritten, 0),
    dailyJobs: 1400,
    dailyTerminalDeletionRowsWritten: Math.ceil(
      deletion.reduce((n, m) => n + m.rowsWritten, 0) * 28,
    ),
    dailyTerminalAdditionalReadAllowance: 2800,
    dailyTerminalAdditionalR2ReadAllowance: 2800,
    dailyRowsRead: Math.ceil(meters.reduce((n, m) => n + m.rowsRead, 0) * 28),
    dailyRowsWritten: Math.ceil(meters.reduce((n, m) => n + m.rowsWritten, 0) * 28),
  };
  await writeFile('measurements/zero-cost-queue.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  await h.close();
}
