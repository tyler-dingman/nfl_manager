import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import {
  LeanEditorial,
  LeanR2Objects,
  type Strategy,
  type EditorialDocument,
} from '../src/lean-editorial';
import { importEditorial, rollbackExport } from '../src/lean-migration';
import { source, publishFixture, video, NOW } from './fixtures';
const document = (id = 'saved'): EditorialDocument => ({
  kind: 'story',
  id,
  headline: 'Original headline',
  category: 'NEWS',
  sourceId: 'source-1',
  publishedAt: NOW,
  teamIds: ['kc', 'sea'],
  payload: {
    id,
    source: 'source-1',
    attribution: { author: 'Original reporter' },
    body: 'Exact article text. '.repeat(100),
  },
});
for (const strategy of ['A', 'B', 'C'] as Strategy[]) {
  test(`${strategy}: unchanged ingestion is read-only; corrections, IDs, pagination and rollback survive`, async () => {
    const h = await harness();
    try {
      const objects = new LeanR2Objects(
          (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
        ),
        store = new LeanEditorial(h.db, objects, strategy);
      const first = document();
      assert.equal((await store.put(first)).revision, 1);
      const meter = h.db.measurements.length,
        writes = objects.writes;
      assert.equal((await store.put(first)).changed, false);
      assert.equal(objects.writes, writes);
      assert.equal(
        h.db.measurements.slice(meter).reduce((n, m) => n + m.rowsWritten, 0),
        0,
      );
      await store.put({
        ...first,
        headline: 'Correction',
        payload: { ...(first.payload as any), correction: true },
      });
      assert.deepEqual((await store.get('story', 'saved', 1))?.payload, first.payload);
      assert.equal((await store.get('story', 'saved'))?.headline, 'Correction');
      await store.put(document('second'));
      const fullPage = await store.fullFeed('kc', 'story', 1);
      assert.equal(fullPage.items.length, 1);
      const page = await store.feed('kc', 'story', 1);
      assert.equal(page.items.length, 1);
      assert.ok(page.nextCursor);
      const second = await store.feed('kc', 'story', 1, page.nextCursor!);
      assert.notEqual(second.items[0].id, page.items[0].id);
      assert.equal((await rollbackExport(store, [{ kind: 'story', id: 'saved' }]))[0].id, 'saved');
      if (strategy === 'C') await assert.rejects(store.history('source-1'), /lacks indexed/);
      else assert.equal((await store.history('source-1')).length, 3);
    } finally {
      await h.close();
    }
  });
  test(`${strategy}: terminal receipts retain original IDs and strict dedupe`, async () => {
    const h = await harness();
    try {
      const store = new LeanEditorial(
        h.db,
        new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
        strategy,
      );
      const payload = { state: 'DONE', originalId: 'job-1', attempt: 3, source: 'source-1' };
      assert.equal(await store.receipt('job', 'job-1', 'once-1', payload), true);
      assert.equal(await store.receipt('job', 'job-1', 'once-1', payload), false);
      assert.deepEqual(await store.readReceipt('job', 'job-1'), payload);
      await assert.rejects(store.receipt('job', 'different', 'once-1', payload), /conflict/);
    } finally {
      await h.close();
    }
  });
}
test('A: interrupted metadata commit leaves source intact; retry and duplicate race are safe', async () => {
  const h = await harness();
  try {
    const store = new LeanEditorial(
      h.db,
      new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
      'A',
    );
    const original = h.db.batch.bind(h.db);
    let fail = true;
    h.db.batch = async (label, statements) => {
      if (fail && label === 'lean.commit') {
        fail = false;
        throw Error('Worker interrupted');
      }
      return original(label, statements);
    };
    await assert.rejects(store.put(document()), /interrupted/);
    assert.equal(await store.get('story', 'saved'), null);
    await store.put(document());
    assert.deepEqual((await store.get('story', 'saved'))?.payload, document().payload);
    const attempts = await Promise.allSettled([
      store.put(document('race')),
      store.put(document('race')),
    ]);
    assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 2);
    const rows = await h.db.query<any>(
      'test.count',
      'SELECT count(*) n FROM lean_versions WHERE id=?',
      ['race'],
      false,
    );
    assert.equal(rows[0].n, 1);
    const query = h.db.query.bind(h.db);
    h.db.query = async () => {
      throw Error('D1 unavailable');
    };
    await assert.rejects(store.get('story', 'saved'), /D1 unavailable/);
    h.db.query = query;
  } finally {
    await h.close();
  }
});
test('B: failed R2 upload, unavailable bucket, corrupt snapshot, and verified hot recovery', async () => {
  const h = await harness();
  try {
    const memory = new Map<string, Uint8Array>();
    let unavailable = true;
    const store = new LeanEditorial(
      h.db,
      {
        async get(k) {
          return memory.get(k) ?? null;
        },
        async putImmutable(k, b) {
          if (unavailable) throw Error('R2 unavailable');
          const old = memory.get(k);
          if (old && old.some((v, i) => v !== b[i])) throw Error('immutable conflict');
          memory.set(k, b.slice());
        },
      },
      'B',
    );
    await assert.rejects(store.put(document()), /R2 unavailable/);
    assert.equal(await store.get('story', 'saved'), null);
    unavailable = false;
    await store.put(document());
    const backup = new Map(memory);
    memory.clear();
    assert.deepEqual((await store.get('story', 'saved'))?.payload, document().payload);
    await assert.rejects(store.retireHot(NOW + 1), /Missing\/corrupt/);
    await store.repairHot('story', 'saved', 1);
    assert.equal(await store.retireHot(NOW + 1), 1);
    assert.deepEqual((await store.get('story', 'saved'))?.payload, document().payload);
    for (const [key, b] of backup) memory.set(key, new Uint8Array(b.length));
    await assert.rejects(store.get('story', 'saved'), /Missing\/corrupt/);
  } finally {
    await h.close();
  }
});
test('A: exact legacy API snapshots migrate repeatably without changing original graph or contracts', async () => {
  const h = await harness(true);
  try {
    await h.repo.upsertSource(source());
    for (const id of ['a', 'b', 'c']) await publishFixture(h.repo, id);
    await h.repo.upsertVideo(video());
    await h.repo.saveEdition({
      id: 'edition',
      teamId: 'kc',
      briefingDate: '2026-10-16',
      status: 'PUBLISHED',
      generatedAt: NOW,
      sourceFingerprint: 'original',
      items: ['a', 'b', 'c'].map((storyId) => ({ storyId })),
    });
    const payloads = [
      ['story', await h.repo.storyById('a')],
      ['history', await h.repo.historicalVersion('a', 1)],
      ['attribution', await h.repo.attribution('a')],
      ['candidate', await h.repo.candidateRevision('candidate-a', 1)],
      ['film', await h.repo.videosForTeam('sea')],
      ['edition', await h.repo.editionsForTeam('kc')],
      ['home', await h.repo.storiesForTeam('kc')],
    ] as const;
    const documents = payloads.map(([kind, payload]) => ({ ...document(kind), kind, payload }));
    const store = new LeanEditorial(
      h.db,
      new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
      'A',
    );
    assert.deepEqual(await importEditorial(store, documents), { verified: 7, changed: 7 });
    assert.deepEqual(await importEditorial(store, documents), { verified: 7, changed: 0 });
    assert.deepEqual(
      (await rollbackExport(store, documents)).map((d) => d.payload),
      payloads.map((x) => x[1]),
    );
    assert.deepEqual(await h.repo.attribution('a'), payloads[2][1]);
    await assert.rejects(importEditorial(store, [documents[0], documents[0]]), /Duplicate/);
  } finally {
    await h.close();
  }
});
for (const days of [7, 14, 30])
  test(`B: ${days}-day retention preserves all aged/current values`, async () => {
    const h = await harness();
    try {
      const store = new LeanEditorial(
        h.db,
        new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
        'B',
      );
      for (const age of [1, 8, 16, 31])
        await store.put({ ...document(`age-${age}`), publishedAt: NOW - age * 86400000 });
      assert.equal(
        await store.retireHot(NOW - days * 86400000),
        [1, 8, 16, 31].filter((age) => age > days).length,
      );
      for (const age of [1, 8, 16, 31]) assert.ok(await store.get('story', `age-${age}`));
    } finally {
      await h.close();
    }
  });
test('C: long history fails with an explicit query-budget error rather than losing content', async () => {
  const h = await harness();
  try {
    const store = new LeanEditorial(
      h.db,
      new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
      'C',
    );
    for (let revision = 1; revision <= 51; revision++)
      await store.put({ ...document(), payload: { revision } });
    await assert.rejects(store.get('story', 'saved', 1), /invocation budget/);
    assert.deepEqual((await store.get('story', 'saved', 51))?.payload, { revision: 51 });
  } finally {
    await h.close();
  }
});
test('A: original revision history imports, resumes after partial failure, and exports for rollback', async () => {
  const { importEditorialHistory, exportEditorialHistory } = await import('../src/lean-migration');
  const h = await harness();
  try {
    const store = new LeanEditorial(
      h.db,
      new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
      'A',
    );
    const records = [
      { revision: 1, document: document() },
      { revision: 2, document: { ...document(), payload: { id: 'saved', corrected: true } } },
    ];
    const put = store.put.bind(store);
    let fail = true;
    store.put = async (doc) => {
      if ((doc.payload as any).corrected && fail) {
        fail = false;
        throw Error('Interrupted import');
      }
      return put(doc);
    };
    await assert.rejects(importEditorialHistory(store, records), /Interrupted/);
    assert.deepEqual(await importEditorialHistory(store, records), { verified: 2, changed: 1 });
    assert.deepEqual(await importEditorialHistory(store, records), { verified: 2, changed: 0 });
    assert.deepEqual(
      (await exportEditorialHistory(store, [{ kind: 'story', id: 'saved' }])).map(
        (x) => x.document.payload,
      ),
      records.map((x) => x.document.payload),
    );
    await assert.rejects(
      importEditorialHistory(store, [{ revision: 3, document: document('gap') }]),
      /contiguous/,
    );
    assert.equal(await store.get('story', 'gap'), null);
  } finally {
    await h.close();
  }
});
test('A: verified terminal handoff preserves queue dedupe, original IDs and pending leases', async () => {
  const { EditorialJobs } = await import('../src/jobs');
  const { handoffSyntheticJob } = await import('./synthetic-lean-handoff');
  const h = await harness();
  try {
    const store = new LeanEditorial(
        h.db,
        new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
        'A',
      ),
      jobs = new EditorialJobs(h.db, true, 'A');
    const job = {
      id: 'terminal',
      jobType: 'SYNTHETIC',
      idempotencyKey: 'once',
      availableAt: NOW,
      ownerEpoch: 1,
      payload: { original: true },
    };
    await jobs.enqueue(job);
    const claimed = await jobs.claim(NOW + 1, 30000);
    assert.ok(claimed);
    await jobs.complete(claimed, NOW + 2);
    const value = await handoffSyntheticJob(h, store, job.id);
    assert.equal(value.id, job.id);
    assert.deepEqual(value.payload_json, job.payload);
    const m = h.db.measurements.length;
    await jobs.enqueue(job);
    await jobs.enqueue({ ...job, id: 'duplicate-id' });
    assert.equal(
      h.db.measurements.slice(m).reduce((n, x) => n + x.rowsWritten, 0),
      0,
    );
    assert.equal(await jobs.claim(NOW + 3, 30000), null);
    await assert.rejects(jobs.enqueue({ ...job, idempotencyKey: 'different' }), /already archived/);
    await jobs.enqueue({ ...job, id: 'pending', idempotencyKey: 'pending' });
    await assert.rejects(handoffSyntheticJob(h, store, 'pending'), /Terminal job/);
    assert.ok(await jobs.claim(NOW + 4, 30000));
  } finally {
    await h.close();
  }
});

test('A: a national record retains all 32 team links within the invocation query budget', async () => {
  const { TEAM_IDS } = await import('../src/teams');
  const h = await harness();
  try {
    const store = new LeanEditorial(
      h.db,
      new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket),
      'A',
    );
    const start = h.db.measurements.length;
    await store.put({ ...document('national'), teamIds: [...TEAM_IDS] });
    assert.ok(h.db.measurements.slice(start).reduce((n, m) => n + m.statements, 0) <= 8);
    for (const team of TEAM_IDS)
      assert.equal((await store.feed(team, 'story')).items[0].id, 'national');
  } finally {
    await h.close();
  }
});
