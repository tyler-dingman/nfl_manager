import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1UserRepository } from '../../../packages/storage/user';
import { offloadSavedMetadata } from '../../../packages/storage/saved-metadata';
test('saved bet metadata offloads losslessly, retaining original IDs, owner guards and bounded indexed cleanup', async () => {
  const h = await harness();
  try {
    const objects = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
    );
    const s = new Storage(h.binding as unknown as SqlDatabase, objects),
      users = new D1UserRepository(s),
      owner = (await new D1AuthRepository(s).createEmailUser({
        email: 'storage@example.invalid',
        passwordHash: 'original',
      }))!;
    const metadata = {
      legs: Array.from({ length: 16 }, (_, i) => ({
        id: `original-market-${i}`,
        price: -110,
        line: i,
        source: 'https://example.invalid/original',
        history: 'attribution'.repeat(12),
      })),
    };
    const raw = JSON.stringify(metadata),
      originals = Array.from({ length: 12 }, (_, i) => `original-saved-${i}`);
    for (const id of originals)
      await s
        .statement(
          "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES(?,?,'OTHER',?,'Original bet',?,?)",
          [id, owner.id, id, raw, Date.now()],
        )
        .run();
    const before = Number(
      (
        await s.rows<any>(
          'SELECT sum(length(CAST(metadata_json AS BLOB))) AS bytes FROM app_saved_content',
        )
      )[0].bytes,
    );
    for (let i = 0; i < 4; i++) assert.equal((await offloadSavedMetadata(s)).moved, 3);
    assert.equal((await offloadSavedMetadata(s)).moved, 0);
    const restored = await users.listSavedContent(owner.id);
    assert.deepEqual(restored.map((r: any) => r.id).sort(), originals.sort());
    assert(restored.every((r: any) => JSON.stringify(r.metadata) === raw));
    const after = Number(
      (
        await s.rows<any>(
          'SELECT sum(length(CAST(metadata_json AS BLOB))+coalesce(length(metadata_hash),0)) AS bytes FROM app_saved_content',
        )
      )[0].bytes,
    );
    assert(after < before / 10);
    assert.equal((await users.listSavedContent('other-owner')).length, 0);
    const created = await users.saveContent(owner.id, {
      contentType: 'OTHER',
      contentId: 'new-bet',
      title: 'New',
      metadata,
    });
    assert(
      (await s.rows<any>('SELECT metadata_hash FROM app_saved_content WHERE id=?', [created.id]))[0]
        .metadata_hash,
    );
    const plan = await s.rows<any>(
      'EXPLAIN QUERY PLAN SELECT id FROM app_saved_content WHERE metadata_hash IS NULL AND length(CAST(metadata_json AS BLOB))>512 ORDER BY id LIMIT 3',
    );
    assert(JSON.stringify(plan).includes('app_saved_metadata_pending'));
    await writeFile(
      new URL('../../../reports/production-completion/saved-storage.json', import.meta.url),
      JSON.stringify(
        {
          scope:
            'MEASURED local synthetic metadata column bytes; excludes pages/indexes and R2 backup cost',
          savedRecords: 12,
          beforeColumnBytes: before,
          afterColumnBytes: after,
          r2Reads: objects.reads,
          r2Writes: objects.writes,
          queryPlan: plan,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await h.close();
  }
});
