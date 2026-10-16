import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { NOW } from './fixtures';
let h: Awaited<ReturnType<typeof harness>>;
before(async () => {
  h = await harness();
});
after(async () => {
  await h?.close();
});
const input = (id: string, extra = {}) => ({
  id,
  jobType: 'SYNTHETIC',
  idempotencyKey: id,
  availableAt: NOW,
  ownerEpoch: 1,
  payload: { synthetic: true },
  ...extra,
});
test('concurrent claims cannot share one lease; duplicate enqueue preserves first ID', async () => {
  await h.jobs.enqueue(input('one'));
  await h.jobs.enqueue(input('duplicate', { idempotencyKey: 'one' }));
  const claims = await Promise.all(Array.from({ length: 8 }, () => h.jobs.claim(NOW, 1000)));
  const claimed = claims.filter((x) => x !== null);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, 'one');
  assert.equal(claimed[0].attempts, 1);
  await h.jobs.complete(claimed[0], NOW + 1);
  await assert.rejects(h.jobs.complete(claimed[0], NOW + 2));
  assert.equal(await h.jobs.claim(NOW + 5, 100), null);
});
test('expired leases are reclaimed and stale completions cannot alter current work', async () => {
  await h.jobs.enqueue(input('expired'));
  const first = (await h.jobs.claim(NOW, 100))!;
  assert(first);
  assert.equal(await h.jobs.claim(NOW + 99, 100), null);
  const recovered = (await h.jobs.claim(NOW + 100, 100))!;
  assert.equal(recovered.id, first.id);
  assert.notEqual(recovered.lease_token, first.lease_token);
  assert.equal(recovered.attempts, 2);
  await assert.rejects(h.jobs.complete(first, NOW + 101));
  await assert.rejects(h.jobs.fail(first, NOW + 101, NOW + 200, 'STALE'));
  await h.jobs.complete(recovered, NOW + 101);
});
test('retry deadlines and attempt limits stop poison jobs', async () => {
  await h.jobs.enqueue(input('poison', { maxAttempts: 2 }));
  const first = (await h.jobs.claim(NOW, 100))!;
  await h.jobs.fail(first, NOW + 1, NOW + 1000, 'RETRYABLE');
  assert.equal(await h.jobs.claim(NOW + 999, 100), null);
  const last = (await h.jobs.claim(NOW + 1000, 100))!;
  assert.equal(last.attempts, 2);
  await h.jobs.fail(last, NOW + 1001, NOW + 2000, 'PERMANENT');
  assert.equal(await h.jobs.claim(NOW + 3000, 100), null);
  const [row] = await h.db.query<{ status: string }>(
    'test.dead',
    'SELECT status FROM ingestion_jobs WHERE id=?',
    ['poison'],
  );
  assert.equal(row.status, 'DEAD');
  await h.jobs.enqueue(input('expired-final', { maxAttempts: 1 }));
  await h.jobs.claim(NOW, 100);
  assert.equal(await h.jobs.claim(NOW + 100, 100), null);
  const [expired] = await h.db.query<{ status: string }>(
    'test.exhausted',
    'SELECT status FROM ingestion_jobs WHERE id=?',
    ['expired-final'],
  );
  assert.equal(expired.status, 'DEAD');
});
test('writer epochs fence old jobs and old completion tokens', async () => {
  await h.jobs.enqueue(input('fenced'));
  const old = (await h.jobs.claim(NOW, 1000))!;
  await h.db.batch('test.epoch', [
    h.db.statement(
      "UPDATE content_control SET version=2,value_json='{\"epoch\":2}' WHERE key='writer_epoch'",
    ),
  ]);
  await assert.rejects(h.jobs.enqueue(input('wrong-epoch')));
  await assert.rejects(h.jobs.complete(old, NOW + 1));
  assert.equal(await h.jobs.claim(NOW + 2000, 100, 1), null);
  await h.jobs.enqueue(input('new-epoch', { ownerEpoch: 2 }));
  const fresh = (await h.jobs.claim(NOW + 2000, 100, 2))!;
  assert.equal(fresh.id, 'new-epoch');
  await h.jobs.complete(fresh, NOW + 2001);
});

test('dead-job history does not turn an idle claim into a full ledger scan', async () => {
  for (let i = 0; i < 40; i++) {
    await h.jobs.enqueue(input(`dead-history-${i}`, { ownerEpoch: 2, maxAttempts: 1 }));
    const job = (await h.jobs.claim(NOW, 10, 2))!;
    await h.jobs.fail(job, NOW + 1, NOW + 2, 'SYNTHETIC_DEAD');
  }
  const before = h.db.measurements.length;
  assert.equal(await h.jobs.claim(NOW + 100, 10, 2), null);
  const meter = h.db.measurements.slice(before).find((m) => m.label === 'job.claim')!;
  assert(meter.rowsRead < 20, `Idle claim scanned ${meter.rowsRead} rows`);
});
