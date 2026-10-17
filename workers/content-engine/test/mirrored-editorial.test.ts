import test from 'node:test';
import assert from 'node:assert/strict';
import { MirroredEditorialObjects } from '../src/mirrored-editorial';
import { sha } from '../src/r2-archive';
test('both immutable copies verify before activation and damaged primary reads recover exactly', async () => {
  const first = new Map<string, Uint8Array>(),
    second = new Map<string, Uint8Array>();
  let failBackup = false,
    primaryDown = false;
  const primary = {
    async get(k: string) {
      if (primaryDown) throw Error('R2 unavailable');
      return first.get(k) ?? null;
    },
    async putImmutable(k: string, b: Uint8Array) {
      first.set(k, b.slice());
    },
  };
  const backup = {
    async get(k: string) {
      return second.get(k) ?? null;
    },
    async putImmutable(k: string, b: Uint8Array) {
      if (failBackup) throw Error('Backup unavailable');
      second.set(k, b.slice());
    },
  };
  const mirror = new MirroredEditorialObjects(primary, backup),
    bytes = new TextEncoder().encode('exact original source history'),
    key = `editorial/lean/v1/${await sha(bytes)}.json`;
  failBackup = true;
  await assert.rejects(mirror.putImmutable(key, bytes), /Backup unavailable/);
  assert.equal(second.size, 0);
  failBackup = false;
  await mirror.putImmutable(key, bytes);
  primaryDown = true;
  assert.deepEqual(await mirror.get(key), bytes);
  primaryDown = false;
  first.set(key, new Uint8Array(bytes.length));
  assert.deepEqual(await mirror.get(key), bytes);
  assert.equal(mirror.degradedReads, 2);
  second.clear();
  await assert.rejects(mirror.get(key), /Both editorial/);
});
