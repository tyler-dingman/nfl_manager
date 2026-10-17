import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshingSnapshot } from './refreshing-snapshot';
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('cold reads coalesce, fresh reads reuse, stale reads do not wait for refresh', async () => {
  let clock = 0,
    calls = 0;
  let finish!: (value: { version: number }) => void;
  const read = refreshingSnapshot(
    () => {
      calls++;
      return new Promise<{ version: number }>((resolve) => {
        finish = resolve;
      });
    },
    { now: () => clock, freshMs: 10, maxAgeMs: 30 },
  );
  const a = read(),
    b = read();
  await tick();
  assert.equal(calls, 1);
  finish({ version: 1 });
  assert.deepEqual(await a, await b);
  clock = 11;
  assert.deepEqual(await read(), { version: 1 });
  assert.deepEqual(await read(), { version: 1 });
  assert.equal(calls, 2);
  finish({ version: 2 });
  await tick();
  assert.deepEqual(await read(), { version: 2 });
});
test('refresh failures retain bounded stale data, back off, and reject after hard expiry', async () => {
  let clock = 0,
    calls = 0;
  const read = refreshingSnapshot(
    async () => {
      if (++calls > 1) throw new Error('offline');
      return 'snapshot';
    },
    { now: () => clock, freshMs: 10, maxAgeMs: 30, retryMs: 5 },
  );
  assert.equal(await read(), 'snapshot');
  clock = 11;
  assert.equal(await read(), 'snapshot');
  await tick();
  clock = 12;
  assert.equal(await read(), 'snapshot');
  assert.equal(calls, 2);
  clock = 30;
  await assert.rejects(read(), /offline/);
});
