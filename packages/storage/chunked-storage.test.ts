import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage } from './chunked-storage';
function fixture() {
  const values = new Map<string, string>();
  let fail = false;
  const storage = createChunkedStorage({
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      assert.ok(Buffer.byteLength(value, 'utf8') <= 2048);
      if (fail && key.endsWith('.1')) throw new Error('write failed');
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  });
  return {
    storage,
    values,
    fail() {
      fail = true;
    },
  };
}
test('large native snapshots retain Unicode and replace old chunks', async () => {
  const f = fixture();
  const value = '🏈'.repeat(3000) + 'ends';
  await f.storage.set('slip', value);
  assert.equal(await f.storage.get('slip'), value);
  await f.storage.set('slip', 'small');
  assert.equal(await f.storage.get('slip'), 'small');
  assert.equal(f.values.size, 2);
});
test('a failed write preserves the previous committed snapshot', async () => {
  const f = fixture();
  await f.storage.set('slip', 'previous');
  f.fail();
  await assert.rejects(f.storage.set('slip', 'x'.repeat(1000)));
  assert.equal(await f.storage.get('slip'), 'previous');
  assert.equal(f.values.size, 2);
});
test('an incomplete snapshot raises an error instead of silently losing saved plays', async () => {
  const f = fixture();
  await f.storage.set('slip', 'x'.repeat(1000));
  const key = [...f.values.keys()].find((k) => k.endsWith('.1'))!;
  f.values.delete(key);
  await assert.rejects(f.storage.get('slip'), /Incomplete/);
});
