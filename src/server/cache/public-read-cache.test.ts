import test from 'node:test';
import assert from 'node:assert/strict';
import { cachePublicRead } from './public-read-cache';
test('coalesces identical reads, isolates keys and mutations, expires results', async () => {
  let calls = 0,
    clock = 0;
  const read = cachePublicRead(
    async (id: string) => {
      calls++;
      return { id, items: [1] };
    },
    { ttlMs: 10, maxEntries: 2, now: () => clock },
  );
  const [a, b] = await Promise.all([read('a'), read('a')]);
  assert.equal(calls, 1);
  a.items.push(2);
  assert.deepEqual(b.items, [1]);
  await read('b');
  assert.equal(calls, 2);
  clock = 11;
  await read('a');
  assert.equal(calls, 3);
  await read('c');
  await read('b');
  assert.equal(calls, 5);
});
test('failed reads are retried rather than cached', async () => {
  let calls = 0;
  const read = cachePublicRead(async () => {
    if (++calls === 1) throw new Error('offline');
    return 1;
  });
  await assert.rejects(read());
  assert.equal(await read(), 1);
  assert.equal(calls, 2);
});
