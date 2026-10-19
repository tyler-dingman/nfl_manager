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
test('multi-D1 runner drains dispatch and handoff before advancing owners and checkpoints a bounded continuation', async () => {
  const seen = [];
  const replies = [
    { ok: true, owner: 'D1_TEAM_1', busyOrNoDueSources: true, nextAction: 'dispatch' },
    { ok: true, owner: 'D1_TEAM_1', done: true, nextAction: 'candidate' },
    { ok: true, owner: 'D1_TEAM_1', nextAction: 'handoff' },
    { ok: true, owner: 'D1_TEAM_1', done: true, nextAction: 'poll', nextOwner: 'D1_TEAM_2' },
    { ok: true, owner: 'D1_TEAM_2', nextAction: 'poll', batch: 'durable-owned-batch' },
    { ok: true },
  ];
  const result = await runContentContinuations(async (q) => {
    seen.push(Object.fromEntries(q));
    return replies.shift();
  }, 6);
  assert.equal(result.calls, 6);
  assert.equal(result.complete, false);
  assert.deepEqual(
    seen.map((q) => q.action),
    ['poll', 'dispatch', 'candidate', 'handoff', 'poll', 'checkpoint'],
  );
  assert.equal(seen[4].owner, 'D1_TEAM_2');
  assert.equal(seen[5].batch, 'durable-owned-batch');
  assert.equal(seen[5].resume, 'poll');
});
test('multi-D1 scheduler refuses a user-database routing injection', async () => {
  await assert.rejects(
    runContentContinuations(async () => ({ ok: true, owner: 'D1_USERS', nextAction: 'poll' })),
    /Invalid editorial owner/,
  );
});
test('verified idle owners advance without three empty continuation requests', async () => {
  const seen = [];
  const result = await runContentContinuations(async (q) => {
    seen.push(Object.fromEntries(q));
    if (q.get('action') === 'checkpoint') return { ok: true };
    const index = seen.length;
    return {
      ok: true,
      owner: index < 9 ? 'D1_TEAM_' + index : 'D1_SHARED',
      ownerIdle: true,
      nextAction: 'poll',
      nextOwner: index < 8 ? 'D1_TEAM_' + (index + 1) : index === 8 ? 'D1_SHARED' : null,
    };
  });
  assert.equal(result.complete, true);
  assert.equal(result.calls, 10);
  assert.equal(seen.at(-1).action, 'checkpoint');
  assert.equal(seen.at(-1).owner, 'D1_TEAM_1');
});
