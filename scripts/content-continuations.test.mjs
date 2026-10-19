import test from 'node:test';
import assert from 'node:assert/strict';
import { runContentContinuations } from '../workers/content-scheduler/src/continuations.mjs';
test('continuations process multiple batches, drain candidates, then stop on durable idle', async () => {
  const replies = [
      { ok: true, done: false, batch: 'owned', nextAction: 'poll' },
      { ok: true, done: true, nextAction: 'candidate' },
      { ok: true, job: { id: 1 }, nextAction: 'candidate' },
      { ok: true, nextAction: 'poll' },
      { ok: true, busyOrNoDueSources: true, nextAction: 'candidate' },
      { ok: true, nextAction: 'poll' },
    ],
    seen = [];
  const result = await runContentContinuations(async (q) => {
    seen.push(q.toString());
    return replies.shift();
  });
  assert.equal(result.complete, true);
  assert.equal(result.calls, 6);
  assert.equal(seen[1], 'action=poll&batch=owned');
  assert.equal(seen[4], 'action=poll');
});
test('bounded scheduler never loops indefinitely or follows a supplied URL', async () => {
  let calls = 0;
  const result = await runContentContinuations(async () => {
    calls++;
    return { ok: true, nextAction: 'poll', batch: 'token', url: 'https://attacker.invalid' };
  });
  assert.equal(calls, 32);
  assert.equal(result.complete, false);
  await assert.rejects(
    runContentContinuations(async () => ({ ok: true, nextAction: 'https://attacker.invalid' })),
    /Invalid continuation/,
  );
  await assert.rejects(
    runContentContinuations(async () => ({ ok: false })),
    /failed/,
  );
});
