import test from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_OWNERS, MAPPING_VERSION } from './multi-d1';
import { sealMultiD1Archive, openMultiD1Archive, type ShardExport } from './multi-d1-recovery';
test('encrypted ten-shard archive rejects incomplete, corrupted and mixed maintenance windows', async () => {
  const secret = 'synthetic-offline-owner-key-more-than-32-characters';
  const exports: ShardExport[] = DATABASE_OWNERS.map((owner) => ({
    owner,
    mappingVersion: MAPPING_VERSION,
    windowId: 'synthetic-window',
    epoch: 3,
    snapshot: { originalId: owner, rows: [{ id: 'unchanged' }] },
  }));
  const archive = await sealMultiD1Archive(exports, secret, 'synthetic-window');
  assert.deepEqual((await openMultiD1Archive(archive, secret)).exports, exports);
  await assert.rejects(
    sealMultiD1Archive(exports.slice(1), secret, 'synthetic-window'),
    /Complete/,
  );
  await assert.rejects(
    sealMultiD1Archive(
      exports.map((e, i) => (i === 0 ? { ...e, windowId: 'different' } : e)),
      secret,
      'synthetic-window',
    ),
    /identity/,
  );
  const missing = structuredClone(archive);
  delete missing.shards.D1_TEAM_1;
  await assert.rejects(openMultiD1Archive(missing, secret), /manifest/);
  const corrupt = structuredClone(archive);
  corrupt.shards.D1_TEAM_1 = corrupt.shards.D1_USERS;
  await assert.rejects(openMultiD1Archive(corrupt, secret), /identity/);
  const tampered = structuredClone(archive),
    sealed = tampered.shards.D1_TEAM_1!;
  sealed.cipher = (sealed.cipher[0] === 'A' ? 'B' : 'A') + sealed.cipher.slice(1);
  await assert.rejects(openMultiD1Archive(tampered, secret));
  await assert.rejects(openMultiD1Archive(archive, 'wrong-synthetic-key-more-than-32-characters'));
});
