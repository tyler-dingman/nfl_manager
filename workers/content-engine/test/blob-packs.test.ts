import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { BlobPacks } from '../src/blob-packs';
import { PayloadStore } from '../src/payloads';
import { LocalR2Objects } from '../src/r2-archive';
import { retireSyntheticBlobBodies } from './synthetic-blob-retire';

test('shared immutable packs preserve worst-size JSON, references, and explicit local restore', async () => {
  const h = await harness(true);
  try {
    const payloads = new PayloadStore(h.db);
    // Near the 512KB JSON ceiling, mixed Unicode and deterministic poorly compressible text.
    let state = 7,
      text = '';
    while (text.length < 490000) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      text += state.toString(36);
    }
    const value = {
      text: text.slice(0, 490000),
      attribution: 'source Ω 🏈',
      savedId: 'original-id',
    };
    const stored = await payloads.store(value);
    const objects = new LocalR2Objects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    );
    const packs = new BlobPacks(h.db, objects);
    while (await packs.copyBatch()) {}
    assert.deepEqual(await payloads.read(stored), value);
    const [beforeStorage] = await h.db.query<any>(
      'test.storage.before',
      'SELECT count(*) n FROM editorial_blobs',
      [],
      false,
    );
    await retireSyntheticBlobBodies(h, packs);
    const [afterStorage] = await h.db.query<any>(
      'test.storage.after',
      'SELECT count(*) n,sum(length(body)) localBytes FROM editorial_blobs',
      [],
      false,
    );
    assert.equal(afterStorage.n, beforeStorage.n);
    assert.equal(afterStorage.localBytes, 0);
    const [fragments] = await h.db.query<any>(
      'test.storage.fragments',
      'SELECT count(*) n FROM editorial_blob_fragments',
      [],
      false,
    );
    assert.equal(fragments.n, 0);
    assert.deepEqual(await payloads.read(stored), value);
    assert.equal(await packs.copyBatch(), 0);
    const rows = await h.db.query<any>(
      'test.locations',
      'SELECT hash FROM editorial_blobs WHERE pack_id IS NOT NULL',
      [],
      false,
    );
    for (const row of rows) {
      const bytes = await packs.read(row.hash);
      await h.db.batch('test.restore', [
        h.db.statement('UPDATE editorial_blobs SET body=? WHERE hash=?', [bytes!.buffer, row.hash]),
      ]);
    }
    h.db.resolveBlob = undefined;
    assert.deepEqual(await payloads.read(stored), value);
  } finally {
    await h.close();
  }
});

test('failed uploads retain originals; missing/corrupt packs fail closed', async () => {
  const h = await harness();
  try {
    const payloads = new PayloadStore(h.db),
      value = { text: 'historical attribution '.repeat(1000) },
      stored = await payloads.store(value);
    const objects = new Map<string, Uint8Array>();
    let fail = true;
    const packs = new BlobPacks(h.db, {
      async get(key) {
        return objects.get(key) ?? null;
      },
      async putImmutable(key, bytes) {
        if (fail) throw Error('upload failure');
        objects.set(key, bytes.slice());
      },
    });
    await assert.rejects(packs.copyBatch(), /upload failure/);
    assert.deepEqual(await payloads.read(stored), value);
    fail = false;
    while (await packs.copyBatch()) {}
    await retireSyntheticBlobBodies(h, packs);
    const backup = new Map(objects);
    objects.clear();
    await assert.rejects(payloads.read(stored), /checksum/);
    for (const [key, bytes] of backup) objects.set(key, new Uint8Array(bytes.length));
    await assert.rejects(payloads.read(stored), /checksum/);
    for (const [key, bytes] of backup) objects.set(key, bytes);
    assert.deepEqual(await payloads.read(stored), value);
  } finally {
    await h.close();
  }
});

test('offloaded graph survives restart with saved IDs, corrections, team history and source attribution', async () => {
  const { source, publishFixture, video } = await import('./fixtures');
  const { EditorialDatabase } = await import('../src/database');
  const { EditorialRepository } = await import('../src/repository');
  const { EditorialR2Archive } = await import('../src/r2-archive');
  const h = await harness(true);
  try {
    await h.repo.upsertSource(source());
    await publishFixture(h.repo, 'saved-original');
    await publishFixture(h.repo, 'saved-second');
    await publishFixture(h.repo, 'saved-third');
    for (const date of ['2026-10-14', '2026-10-15'])
      await h.repo.saveEdition({
        id: `edition-${date}`,
        teamId: 'kc',
        briefingDate: date,
        status: 'PUBLISHED',
        generatedAt: 1800000000000,
        sourceFingerprint: date,
        items: ['saved-original', 'saved-second', 'saved-third'].map((storyId) => ({
          storyId,
          summary: 'Preserved briefing source links. '.repeat(100),
        })),
      });
    await h.repo.upsertVideo(video());
    const snapshot = async (repo: typeof h.repo) => ({
      story: await repo.storyById('saved-original'),
      old: await repo.historicalVersion('saved-original', 1),
      evidence: await repo.attribution('saved-original'),
      candidate: await repo.candidateRevision('candidate-saved-original', 1),
      historySearch: await repo.db.query(
        'test.history.search',
        'SELECT r.candidate_id,r.revision,r.record_json FROM content_candidates c JOIN content_candidate_revisions r ON r.candidate_id=c.id WHERE c.source_id=? AND r.observed_at>=? ORDER BY r.candidate_id,r.revision',
        ['source-1', 0],
      ),
      feed: await repo.storiesForTeam('kc'),
      videos: await repo.videosForTeam('sea'),
      editions: await repo.editionsForTeam('kc'),
    });
    const expected = await snapshot(h.repo);
    const legacy = new EditorialR2Archive(
      h.db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    assert.ok(await legacy.archive('version', 1800000000001, 1804000000000));
    const manifests = await h.db.query<any>(
      'test.manifests',
      "SELECT id FROM r2_archive_manifests WHERE state='ACTIVE'",
      [],
      false,
    );
    const packs = new BlobPacks(
      h.db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    while (await packs.copyBatch(8, 32000)) {}
    await retireSyntheticBlobBodies(h, packs);
    assert.deepEqual(await snapshot(h.repo), expected);
    const binding = await h.restart(),
      db = new EditorialDatabase(binding as unknown as D1Database);
    const repo = new EditorialRepository(db, true);
    new BlobPacks(
      db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    const restartedArchive = new EditorialR2Archive(
      db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    assert.deepEqual(await snapshot(repo), expected);
    for (const manifest of manifests) await restartedArchive.restore(manifest.id);
    assert.deepEqual(await snapshot(repo), expected);
  } finally {
    await h.close();
  }
});
