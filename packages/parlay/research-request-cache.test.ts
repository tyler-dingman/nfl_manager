import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchRequestCache } from './research-request-cache';
test('partial builds coalesce in flight but are polled again; completed data is cached', async () => {
  let count = 0;
  const read = createResearchRequestCache(
    async () => ({ progress: { complete: ++count > 1 } }),
    () => 0,
    (value) => (value.progress.complete ? 60_000 : 0),
  );
  const [a, b] = await Promise.all([read('all'), read('all')]);
  assert.equal(count, 1);
  assert.deepEqual(a, b);
  assert.equal(a.progress.complete, false);
  assert.equal((await read('all')).progress.complete, true);
  await read('all');
  assert.equal(count, 2);
});
