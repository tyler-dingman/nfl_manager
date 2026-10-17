import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { LeanEditorial, LeanR2Objects, type EditorialDocument } from '../src/lean-editorial';
import { createLeanCheckpoint, restoreLeanCheckpoint } from '../src/lean-checkpoint';

test('coherent lean checkpoint restores saved IDs, source-attributed revisions and rejects corruption before writes', async () => {
  const source = await harness(),
    target = await harness();
  try {
    const objects = new LeanR2Objects(
      (await source.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    );
    const backup = new LeanR2Objects(
      (await source.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as R2Bucket,
    );
    const restoredObjects = new LeanR2Objects(
      (await target.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    );
    const store = new LeanEditorial(source.db, objects, 'A');
    const original: EditorialDocument = {
      kind: 'story',
      id: 'saved-original-id',
      headline: 'Original',
      category: 'news',
      sourceId: 'original-source',
      publishedAt: 1,
      teamIds: ['kc', 'sea'],
      payload: { body: 'x'.repeat(511_980), attribution: [] },
    };
    // Stay inside the original 512 KB payload boundary; no truncation in backup.
    original.payload = { body: 'x'.repeat(511_960), attribution: [] };
    await store.put(original);
    await store.put({
      ...original,
      headline: 'Correction',
      publishedAt: 2,
      payload: { correction: 'preserved' },
    });
    const checkpoint = await createLeanCheckpoint(source.db, objects, backup);
    const broken = structuredClone(checkpoint);
    broken.tables.lean_heads[0].id = 'tampered';
    await assert.rejects(
      restoreLeanCheckpoint(target.db, backup, restoredObjects, broken),
      /checksum/,
    );
    const bucket = await source.mf.getR2Bucket('EDITORIAL_BACKUP');
    const key = checkpoint.objects[0].key,
      bytes = await backup.get(key);
    await bucket.put(key, 'corrupt');
    await assert.rejects(
      restoreLeanCheckpoint(target.db, backup, restoredObjects, checkpoint),
      /corrupt/,
    );
    assert.equal(
      (await target.binding.prepare('SELECT count(*) n FROM lean_heads').first<{ n: number }>())?.n,
      0,
    );
    await bucket.put(key, bytes!);
    const result = await restoreLeanCheckpoint(target.db, backup, restoredObjects, checkpoint);
    assert.equal(result.objects, 2);
    const restored = new LeanEditorial(target.db, restoredObjects, 'A');
    assert.deepEqual(await restored.get('story', original.id, 1), original);
    assert.equal((await restored.get('story', original.id))?.headline, 'Correction');
    assert.equal((await restored.history('original-source')).length, 2);
    await assert.rejects(
      restoreLeanCheckpoint(target.db, backup, restoredObjects, checkpoint),
      /empty/,
    );
  } finally {
    await source.close();
    await target.close();
  }
});
