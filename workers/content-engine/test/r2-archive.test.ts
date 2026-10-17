import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { source, candidate, NOW, publishFixture } from './fixtures';
import { EditorialR2Archive, LocalR2Objects, type PrivateArchiveObjects } from '../src/r2-archive';
import { ColdRecords } from '../src/archive';
async function fixture() {
  const h = await harness();
  await h.repo.upsertSource(source());
  const c = candidate();
  await h.repo.insertCandidate(c);
  await h.repo.insertCandidate({
    ...c,
    rawText: c.rawText + ' correction',
    fingerprint: 'corrected',
  });
  const objects = new LocalR2Objects(
    (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
  );
  const archive = new EditorialR2Archive(h.db, objects);
  return { h, objects, archive };
}
test('private local R2 preserves historical revisions, Unicode, attribution, IDs and saved story links', async () => {
  const { h, archive } = await fixture();
  try {
    const expected = await h.repo.candidateRevision('candidate-1', 1);
    await publishFixture(h.repo, 'saved');
    const original = await h.repo.historicalVersion('saved', 1);
    const id = await archive.archive('revision', NOW + 1, NOW + 2);
    assert.ok(id);
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
    assert.equal((await h.repo.candidateRevision('candidate-1', 1)).author, 'Synthetic Reporter');
    assert.ok((await h.repo.candidateRevision('candidate-1', 2)).rawText.endsWith('correction'));
    await archive.archive('version', NOW + 1, NOW + 2);
    assert.deepEqual(await h.repo.historicalVersion('saved', 1), original);
    assert.equal((await h.repo.storyById('saved')).id, 'saved');
    assert.equal((await h.repo.historicalVersion('saved', 2)).version, 2);
    assert.equal(
      (
        await h.binding
          .prepare('SELECT count(*) n FROM story_evidence WHERE source_id=?')
          .bind('source-1')
          .first<any>()
      ).n,
      1,
    );
    const backup = await h.binding
      .prepare('SELECT original_json FROM r2_archive_records WHERE manifest_id=?')
      .bind(id)
      .first<any>();
    assert.ok(backup.original_json);
  } finally {
    await h.close();
  }
});
test('duplicate archive is a no-op, restart reader resolves same durable pointers and restore preserves revisions', async () => {
  const { h, archive, objects } = await fixture();
  try {
    const expected = await h.repo.candidateRevision('candidate-1', 1);
    const id = (await archive.archive('revision', NOW + 1, NOW + 2))!;
    assert.equal(await archive.archive('revision', NOW + 1, NOW + 3), null);
    new EditorialR2Archive(h.db, objects);
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
    await archive.restore(id);
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
    await archive.restore(id);
  } finally {
    await h.close();
  }
});
for (const fault of ['upload', 'interrupted', 'concurrent', 'partial-transaction'] as const)
  test(`${fault} failure preserves original D1 history and atomic pointers`, async () => {
    const { h, objects } = await fixture();
    try {
      const expected = await h.repo.candidateRevision('candidate-1', 1);
      const failing: PrivateArchiveObjects = {
        get: (k) => objects.get(k),
        putImmutable: async (k, b) => {
          if (fault === 'upload') throw Error('Synthetic upload failure');
          await objects.putImmutable(k, b);
        },
      };
      const a = new EditorialR2Archive(h.db, failing);
      await assert.rejects(
        a.archive('revision', NOW + 1, NOW + 2, 86400000, async () => {
          if (fault === 'interrupted') throw Error('Synthetic crash');
          if (fault === 'concurrent')
            await h.binding
              .prepare(
                "UPDATE content_candidate_revisions SET observed_at=? WHERE candidate_id='candidate-1' AND revision=1",
              )
              .bind(NOW + 100)
              .run();
          if (fault === 'partial-transaction')
            await h.binding
              .prepare(
                "INSERT INTO transaction_assertions(token,value) VALUES('synthetic-invalid',0)",
              )
              .run();
        }),
      );
      assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
      assert.equal(
        (await h.binding.prepare('SELECT count(*) n FROM r2_archive_records').first<any>()).n,
        0,
      );
      assert.equal(
        (
          await h.binding
            .prepare("SELECT count(*) n FROM r2_archive_manifests WHERE state='ACTIVE'")
            .first<any>()
        ).n,
        0,
      );
      if (fault === 'interrupted') {
        assert.ok(await a.archive('revision', NOW + 1, NOW + 3));
      }
    } finally {
      await h.close();
    }
  });
for (const fault of ['corrupt', 'missing', 'stale', 'wrong-directory'] as const)
  test(`${fault} archive fails closed while recovery copy survives`, async () => {
    const { h, objects, archive } = await fixture();
    try {
      const id = (await archive.archive('revision', NOW + 1, NOW + 2))!;
      const m = await archive.manifest(id);
      const bucket = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE');
      if (fault === 'corrupt') await bucket.put(m.object_key, 'corrupt');
      if (fault === 'missing') await bucket.delete(m.object_key);
      if (fault === 'stale')
        await h.binding
          .prepare("UPDATE r2_archive_manifests SET state='PREPARED' WHERE id=?")
          .bind(id)
          .run();
      if (fault === 'wrong-directory')
        await h.binding
          .prepare('UPDATE r2_archive_records SET ordinal=7 WHERE manifest_id=?')
          .bind(id)
          .run();
      await assert.rejects(h.repo.candidateRevision('candidate-1', 1));
      const row = await h.binding
        .prepare('SELECT original_json FROM r2_archive_records WHERE manifest_id=?')
        .bind(id)
        .first<any>();
      assert.ok(row.original_json);
      assert.ok(await archive.payloads.read(row.original_json));
      if (fault === 'corrupt' || fault === 'missing') {
        await archive.restore(id, true);
        assert.ok(await h.repo.candidateRevision('candidate-1', 1));
      }
    } finally {
      await h.close();
    }
  });
test('atomic activation rolls back earlier members when a later member changes', async () => {
  const { h, archive } = await fixture();
  try {
    const c = candidate('second');
    await h.repo.insertCandidate(c);
    await h.repo.insertCandidate({ ...c, rawText: 'changed', fingerprint: 'changed' });
    await assert.rejects(
      archive.archive('revision', NOW + 1, NOW + 2, 1000, async () => {
        await h.binding
          .prepare(
            "UPDATE content_candidate_revisions SET observed_at=? WHERE candidate_id='second' AND revision=1",
          )
          .bind(NOW + 200)
          .run();
      }),
    );
    const rows = (
      await h.binding.prepare('SELECT record_json FROM content_candidate_revisions').all<any>()
    ).results;
    assert.ok(rows.every((r) => !r.record_json.includes('$archive')));
    assert.equal(
      (await h.binding.prepare('SELECT count(*) n FROM r2_archive_records').first<any>()).n,
      0,
    );
  } finally {
    await h.close();
  }
});
test('completed operational payloads and old source checks retrieve transparently; active jobs and pending outbox stay hot', async () => {
  const { h, archive } = await fixture();
  try {
    for (const id of ['active', 'done'])
      await h.jobs.enqueue({
        id,
        jobType: 'SYNTHETIC',
        idempotencyKey: id,
        availableAt: NOW,
        ownerEpoch: 1,
        payload: { id, text: 'é🏈'.repeat(1000) },
      });
    await h.binding.prepare("UPDATE ingestion_jobs SET status='DONE' WHERE id='done'").run();
    await h.repo.recordSourceCheck({
      id: 'check',
      sourceId: 'source-1',
      attemptedAt: NOW,
      successful: true,
      nextCheckAt: NOW + 100,
      cursor: { original: null },
    });
    await publishFixture(h.repo, 'outbox-story');
    const cold = new ColdRecords(h.db);
    const before = await cold.get('job', 'done');
    const check = await cold.get('check', 'check');
    await archive.archive('job', NOW + 1, NOW + 2);
    await archive.archive('check', NOW + 1, NOW + 2);
    assert.deepEqual(await cold.get('job', 'done'), before);
    assert.deepEqual(await cold.get('check', 'check'), check);
    assert.equal(await archive.archive('outbox', NOW + 1, NOW + 2), null);
    assert.equal((await archive.select('job', NOW + 1)).length, 0);
    await h.binding
      .prepare('UPDATE content_outbox SET acknowledged_at=? WHERE event_id=?')
      .bind(NOW, 'event-outbox-story')
      .run();
    const outbox = await cold.get('outbox', 'event-outbox-story');
    await archive.archive('outbox', NOW + 1, NOW + 2);
    assert.deepEqual(await cold.get('outbox', 'event-outbox-story'), outbox);
    await h.jobs.enqueue({
      id: 'new-id',
      jobType: 'SYNTHETIC',
      idempotencyKey: 'done',
      availableAt: NOW,
      ownerEpoch: 1,
      payload: {},
    });
    assert.equal(
      (
        await h.binding
          .prepare("SELECT count(*) n FROM ingestion_jobs WHERE id='new-id'")
          .first<any>()
      ).n,
      0,
    );
  } finally {
    await h.close();
  }
});
test('old published editions preserve full response, dates and source story references; latest remains hot', async () => {
  const { h, archive } = await fixture();
  try {
    for (let i = 0; i < 3; i++) await publishFixture(h.repo, `edition-story-${i}`, null);
    for (let i = 0; i < 2; i++)
      await h.repo.saveEdition({
        id: `edition-${i}`,
        teamId: 'kc',
        briefingDate: `2027-01-0${i + 1}`,
        status: 'PUBLISHED',
        generatedAt: NOW + i,
        sourceFingerprint: 'synthetic',
        items: [0, 1, 2].map((n) => ({
          storyId: `edition-story-${n}`,
          text: 'source summary '.repeat(100),
        })),
      });
    const expected = await h.repo.editionsForTeam('kc');
    await archive.archive('edition', NOW + 10, NOW + 20);
    assert.deepEqual(await h.repo.editionsForTeam('kc'), expected);
    assert.equal((await archive.select('edition', NOW + 10)).length, 0);
  } finally {
    await h.close();
  }
});

test('synthetic-only retirement respects recovery window and restores losslessly after blob removal', async () => {
  const { h, archive } = await fixture();
  try {
    const { retireSyntheticCopies } = await import('./synthetic-retire');
    const expected = await h.repo.candidateRevision('candidate-1', 1);
    const id = (await archive.archive('revision', NOW + 1, NOW + 2, 1000))!;
    assert.equal(
      (await retireSyntheticCopies(h, archive, NOW + 3, 'DISPOSABLE_SYNTHETIC_ONLY'))
        .verifiedManifests,
      0,
    );
    await retireSyntheticCopies(h, archive, NOW + 2000, 'DISPOSABLE_SYNTHETIC_ONLY');
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
    await assert.rejects(archive.restore(id, true), /unavailable/);
    await archive.restore(id);
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
  } finally {
    await h.close();
  }
});
test('source revisions pinned by current publishing, including legacy unknown pins, stay hot', async () => {
  const { h, archive } = await fixture();
  try {
    const { story } = await import('./fixtures');
    await h.repo.createStory(story('active-draft'));
    await h.repo.associateEvidence({
      id: 'pinned',
      storyId: 'active-draft',
      candidateId: 'candidate-1',
      sourceId: 'source-1',
      firstSeenAt: NOW,
    });
    const c = candidate();
    await h.repo.insertCandidate({ ...c, rawText: 'third correction', fingerprint: 'third' });
    const selected = await archive.select('revision', NOW + 1);
    assert.deepEqual(
      selected.map((x) => x.revision),
      [1],
    );
    await h.binding
      .prepare("UPDATE story_evidence SET candidate_revision=NULL WHERE id='pinned'")
      .run();
    assert.equal((await archive.select('revision', NOW + 1)).length, 0);
  } finally {
    await h.close();
  }
});
test('archive factory rejects remote environment and missing private bucket; future cutoffs fail', async () => {
  const { h, archive } = await fixture();
  try {
    const { createLocalArchive } = await import('../src/r2-bindings');
    assert.throws(() => createLocalArchive({ CONTENT_ENV: 'production' }));
    assert.throws(() =>
      createLocalArchive({
        EDITORIAL_DB: h.binding,
        CONTENT_ENV: 'local',
        CONTENT_NETWORK_ENABLED: 'false',
      }),
    );
    await assert.rejects(archive.archive('revision', NOW + 100, NOW));
  } finally {
    await h.close();
  }
});
test('concurrent duplicate archive attempts cannot publish partial or duplicate pointers', async () => {
  const { h, archive } = await fixture();
  try {
    const expected = await h.repo.candidateRevision('candidate-1', 1);
    await Promise.allSettled([
      archive.archive('revision', NOW + 1, NOW + 2),
      archive.archive('revision', NOW + 1, NOW + 2),
    ]);
    assert.deepEqual(await h.repo.candidateRevision('candidate-1', 1), expected);
    assert.equal(
      (await h.binding.prepare('SELECT count(*) n FROM r2_archive_records').first<any>()).n,
      1,
    );
  } finally {
    await h.close();
  }
});
test('withdrawn historical evidence archives losslessly; active publishing evidence remains hot', async () => {
  const { h, archive } = await fixture();
  try {
    await publishFixture(h.repo, 'old-evidence');
    const original = (
      await h.db.query<any>(
        'test.evidence',
        "SELECT record_json FROM story_evidence WHERE id='evidence-old-evidence'",
      )
    )[0].record_json;
    assert.equal((await archive.select('evidence', NOW + 1)).length, 0);
    await h.binding
      .prepare("UPDATE canonical_stories SET publication_state='WITHDRAWN' WHERE id='old-evidence'")
      .run();
    assert.ok(await archive.archive('evidence', NOW + 1, NOW + 2));
    assert.equal(
      (
        await h.db.query<any>(
          'test.evidence',
          "SELECT record_json FROM story_evidence WHERE id='evidence-old-evidence'",
        )
      )[0].record_json,
      original,
    );
  } finally {
    await h.close();
  }
});
test('durable D1 directory and private R2 objects survive emulator restart', async () => {
  const h = await harness(true);
  try {
    await h.repo.upsertSource(source());
    const c = candidate();
    await h.repo.insertCandidate(c);
    await h.repo.insertCandidate({ ...c, rawText: 'new source revision', fingerprint: 'new' });
    const expected = await h.repo.candidateRevision(c.id, 1);
    const a = new EditorialR2Archive(
      h.db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    await a.archive('revision', NOW + 1, NOW + 2);
    const binding = await h.restart();
    const { EditorialDatabase } = await import('../src/database');
    const { EditorialRepository } = await import('../src/repository');
    const db = new EditorialDatabase(binding as unknown as D1Database);
    const repo = new EditorialRepository(db);
    new EditorialR2Archive(
      db,
      new LocalR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
    );
    assert.deepEqual(await repo.candidateRevision(c.id, 1), expected);
  } finally {
    await h.close();
  }
});
test('existing local repository factory transparently resolves archived response contracts when bucket is bound', async () => {
  const { h, archive } = await fixture();
  try {
    const expected = await h.repo.candidateRevision('candidate-1', 1);
    await archive.archive('revision', NOW + 1, NOW + 2);
    const { createLocalRepository } = await import('../src/worker-repository');
    const repo = createLocalRepository({
      EDITORIAL_DB: h.binding,
      EDITORIAL_ARCHIVE: await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
      CONTENT_ENV: 'local',
      CONTENT_NETWORK_ENABLED: 'false',
    });
    assert.deepEqual(await repo.candidateRevision('candidate-1', 1), expected);
  } finally {
    await h.close();
  }
});
test('corrupt recovery copy and changed restore target fail without overwriting authoritative data', async () => {
  const { h, archive } = await fixture();
  try {
    const id = (await archive.archive('revision', NOW + 1, NOW + 2))!;
    const original = await h.binding
      .prepare('SELECT original_json FROM r2_archive_records WHERE manifest_id=?')
      .bind(id)
      .first<any>();
    await h.binding
      .prepare("UPDATE r2_archive_records SET original_json='{}' WHERE manifest_id=?")
      .bind(id)
      .run();
    await assert.rejects(archive.restore(id), /checksum/);
    await assert.rejects(archive.restore(id, true), /checksum/);
    await h.binding
      .prepare('UPDATE r2_archive_records SET original_json=? WHERE manifest_id=?')
      .bind(original.original_json, id)
      .run();
    await h.binding
      .prepare(
        "UPDATE content_candidate_revisions SET record_json='{}' WHERE candidate_id='candidate-1' AND revision=1",
      )
      .run();
    await assert.rejects(archive.restore(id));
    assert.equal(
      (
        await h.binding
          .prepare(
            "SELECT record_json FROM content_candidate_revisions WHERE candidate_id='candidate-1' AND revision=1",
          )
          .first<any>()
      ).record_json,
      '{}',
    );
    assert.equal((await archive.manifest(id)).state, 'ACTIVE');
  } finally {
    await h.close();
  }
});
test('user JSON with reserved archive marker is escaped losslessly rather than interpreted as a pointer', async () => {
  const { h, archive } = await fixture();
  try {
    const value = {
      $archive: 'dd-private-r2-v1',
      manifest: 'ordinary user data',
      kind: 'revision',
      id: 'user-id',
      revision: 1,
      text: '🏈 é',
    };
    const stored = await archive.payloads.store(value);
    assert.ok(stored.includes('$storage'));
    assert.deepEqual(await archive.payloads.read(stored), value);
    const { PayloadStore } = await import('../src/payloads');
    const inlineWriter = new PayloadStore(h.db, false);
    assert.deepEqual(await inlineWriter.read(await inlineWriter.store(value)), value);
  } finally {
    await h.close();
  }
});
