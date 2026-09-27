import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCrewRank } from './crew-rank';
test('missing optional crew schema does not fail rewards', async () => {
  assert.deepEqual(
    await loadCrewRank(async () => {
      throw { code: '42P01' };
    }),
    { rank: null, available: false },
  );
});
test('crew rank distinguishes no membership from unavailable schema', async () => {
  assert.deepEqual(await loadCrewRank(async () => []), { rank: null, available: true });
  assert.deepEqual(await loadCrewRank(async () => [{ rank: 2 }]), { rank: 2, available: true });
});
test('unexpected query errors remain visible', async () => {
  await assert.rejects(
    loadCrewRank(async () => {
      throw new Error('connection failed');
    }),
    /connection failed/,
  );
});
