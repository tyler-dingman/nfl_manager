import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { candidate, source, story, NOW, publishFixture } from './fixtures';
import { PayloadStore } from '../src/payloads';
import { ColdRecords } from '../src/archive';
import { repackRow } from '../src/repack';
import { EditorialDatabase } from '../src/database';
import { EditorialRepository } from '../src/repository';

test('compact codec preserves arbitrary JSON, Unicode, BOM and reserved keys; shares exact chunks', async () => {
  const h = await harness();
  try {
    const p = new PayloadStore(h.db),
      text = '\ufeff🏈 é 漢字 '.repeat(1500),
      value = {
        $storage: 'dd-editorial-payload-v1',
        root: 'user value',
        nested: [null, false, 1, { __proto__: null, text }],
        text,
      };
    const stored = await p.store(value);
    assert.deepEqual(await p.read(stored), JSON.parse(JSON.stringify(value)));
    const count = await h.binding
      .prepare('SELECT count(*) n FROM editorial_blobs')
      .first<{ n: number }>();
    assert.equal(await p.store(value), stored);
    assert.equal(
      (await h.binding.prepare('SELECT count(*) n FROM editorial_blobs').first<{ n: number }>())!.n,
      count!.n,
    );
    const updated = { ...value, small: 'revision' };
    await p.store(updated);
    assert.equal(
      (await h.binding.prepare('SELECT count(*) n FROM editorial_blobs').first<{ n: number }>())!.n,
      count!.n + 1,
    );
  } finally {
    await h.close();
  }
});
test('missing and corrupt blobs fail closed', async () => {
  const h = await harness();
  try {
    const p = new PayloadStore(h.db),
      stored = await p.store({ text: 'evidence '.repeat(1000) }),
      root = JSON.parse(stored).root;
    await h.binding
      .prepare("UPDATE editorial_blobs SET body=x'00',codec='identity' WHERE hash=?")
      .bind(root)
      .run();
    await assert.rejects(p.read(stored), /checksum/);
    await assert.rejects(
      p.read(JSON.stringify({ $storage: 'dd-editorial-payload-v1', root: '0'.repeat(64) })),
      /Missing/,
    );
  } finally {
    await h.close();
  }
});
test('saved story IDs, source attribution and all revisions survive correction, repack and restart', async () => {
  const h = await harness(true, false);
  try {
    await h.repo.upsertSource(source());
    const c = candidate();
    await h.repo.insertCandidate(c);
    const s = story();
    await h.repo.createStory(s);
    await h.repo.associateEvidence({
      id: 'e',
      storyId: s.id,
      candidateId: c.id,
      sourceId: c.sourceId,
      firstSeenAt: NOW,
    });
    await h.repo.insertCandidate({
      ...c,
      rawText: 'CORRECTION '.repeat(900),
      fingerprint: 'corrected',
    });
    assert.equal(await repackRow(h.db, 'content_candidate_revisions', c.id, 1), true);
    assert.equal(await repackRow(h.db, 'content_candidate_revisions', c.id, 1), false);
    await repackRow(h.db, 'content_candidates', c.id);
    assert.deepEqual(await h.repo.candidateRevision(c.id, 1), c);
    assert.equal((await h.repo.attribution(s.id))[0].candidate.rawText, c.rawText);
    assert.equal((await h.repo.candidateRevision(c.id, 2)).rawText, 'CORRECTION '.repeat(900));
    const binding = await h.restart(),
      repo = new EditorialRepository(new EditorialDatabase(binding as unknown as D1Database));
    assert.equal((await repo.storyById(s.id)).id, s.id);
    assert.equal((await repo.historicalVersion(s.id, 1)).headline, s.headline);
    assert.deepEqual(await repo.candidateRevision(c.id, 1), c);
  } finally {
    await h.close();
  }
});
test('cold jobs retain every field and dedupe receipts; active expired leases remain recoverable', async () => {
  const h = await harness();
  try {
    const cold = new ColdRecords(h.db);
    const input = {
      id: 'done',
      jobType: 'SYNTHETIC',
      idempotencyKey: 'once',
      availableAt: NOW,
      ownerEpoch: 1,
      payload: { text: 'payload '.repeat(400) },
    };
    await h.jobs.enqueue(input);
    const job = (await h.jobs.claim(NOW, 10))!;
    await h.jobs.complete(job, NOW + 1);
    const before = await cold.get('job', 'done');
    assert.equal(await cold.compact('job', NOW + 2), 1);
    assert.deepEqual(await cold.get('job', 'done'), before);
    await h.jobs.enqueue({ ...input, id: 'replayed' });
    await assert.rejects(
      h.jobs.enqueue({ ...input, idempotencyKey: 'new-key' }),
      /already archived/,
    );
    assert.equal(await h.jobs.claim(NOW + 2, 10), null);
    await h.jobs.enqueue({ ...input, id: 'active', idempotencyKey: 'active' });
    const active = (await h.jobs.claim(NOW + 2, 10))!;
    assert.equal(await cold.compact('job', NOW + 100), 0);
    const recovered = (await h.jobs.claim(NOW + 20, 10))!;
    assert.equal(recovered.id, active.id);
    assert.notEqual(recovered.lease_token, active.lease_token);
    await assert.rejects(h.jobs.complete(active, NOW + 21));
    await h.jobs.complete(recovered, NOW + 21);
  } finally {
    await h.close();
  }
});
test('checks retain exact history plus daily aggregates; only acknowledged outbox becomes cold', async () => {
  const h = await harness();
  try {
    await h.repo.upsertSource(source());
    const cold = new ColdRecords(h.db);
    for (let i = 0; i < 3; i++)
      await h.repo.recordSourceCheck({
        id: `check-${i}`,
        sourceId: 'source-1',
        attemptedAt: NOW + i,
        successful: i !== 1,
        nextCheckAt: NOW + 100,
        cursor: { i },
      });
    const before = await cold.get('check', 'check-1');
    assert.equal(await cold.compact('check', NOW + 10), 3);
    assert.deepEqual(await cold.get('check', 'check-1'), before);
    await assert.rejects(
      h.repo.recordSourceCheck({
        id: 'check-1',
        sourceId: 'source-1',
        attemptedAt: NOW + 20,
        successful: true,
        nextCheckAt: NOW + 100,
      }),
    );
    const agg = await h.binding.prepare('SELECT checks,successes FROM source_check_daily').first();
    assert.deepEqual(agg, { checks: 3, successes: 2 });
    await publishFixture(h.repo, 'cold-story');
    assert.equal(await cold.compact('outbox', NOW + 10), 0);
    await h.binding
      .prepare('UPDATE content_outbox SET acknowledged_at=? WHERE event_id=?')
      .bind(NOW + 1, 'event-cold-story')
      .run();
    const event = await cold.get('outbox', 'event-cold-story');
    assert.equal(await cold.compact('outbox', NOW + 10), 1);
    assert.deepEqual(await cold.get('outbox', 'event-cold-story'), event);
    assert.equal((await h.repo.storyById('cold-story')).id, 'cold-story');
    assert.equal((await h.repo.historicalVersion('cold-story', 2)).version, 2);
  } finally {
    await h.close();
  }
});
test('archive transaction failure leaves hot history readable and no partial directory', async () => {
  const h = await harness();
  try {
    await h.repo.upsertSource(source());
    await h.repo.recordSourceCheck({
      id: 'check',
      sourceId: 'source-1',
      attemptedAt: NOW,
      successful: true,
      nextCheckAt: NOW + 1,
    });
    // A deliberate conflicting receipt simulates a second compactor winning the race.
    await h.binding.prepare("INSERT INTO archive_chunks VALUES(1,'check',1,'[]',1)").run();
    await h.binding.prepare("INSERT INTO archive_records VALUES('check','check',1,0,NULL)").run();
    const cold = new ColdRecords(h.db);
    await assert.rejects(cold.compact('check', NOW + 2));
    assert.equal((await cold.get('check', 'check'))!.id, 'check');
    assert.equal(
      (await h.binding.prepare('SELECT count(*) n FROM archive_chunks').first<{ n: number }>())!.n,
      1,
    );
  } finally {
    await h.close();
  }
});

test('dense blob fragments preserve high-entropy text and detect missing pieces', async () => {
  const h = await harness();
  try {
    const p = new PayloadStore(h.db);
    const bytes = new Uint8Array(12000);
    crypto.getRandomValues(bytes);
    const value = { text: Buffer.from(bytes).toString('base64') };
    const stored = await p.store(value);
    assert.deepEqual(await p.read(stored), value);
    const row = await h.binding
      .prepare('SELECT hash,part FROM editorial_blob_fragments LIMIT 1')
      .first<{ hash: string; part: number }>();
    assert(row);
    await h.binding
      .prepare('DELETE FROM editorial_blob_fragments WHERE hash=? AND part=?')
      .bind(row.hash, row.part)
      .run();
    await assert.rejects(p.read(stored), /Missing payload fragment/);
  } finally {
    await h.close();
  }
});

test('additive migrations preserve pre-optimization inline IDs, JSON and history', async () => {
  const h = await harness(false, false, 3);
  try {
    await h.repo.upsertSource(source());
    const c = candidate();
    await h.repo.insertCandidate(c);
    const s = story();
    await h.repo.createStory(s);
    const { readFile, readdir } = await import('node:fs/promises');
    for (const file of (await readdir(new URL('../migrations/', import.meta.url)))
      .filter((f) => Number(f.slice(0, 4)) >= 4)
      .sort()) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
      for (const stmt of sql
        .replace(/^--.*$/gm, '')
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean))
        await h.binding.prepare(stmt).run();
    }
    const repo = new EditorialRepository(h.db);
    assert.deepEqual(await repo.candidateRevision(c.id, 1), c);
    assert.deepEqual(await repo.storyById(s.id), s);
    await repackRow(h.db, 'content_candidates', c.id);
    await repackRow(h.db, 'content_candidate_revisions', c.id, 1);
    assert.deepEqual(await repo.candidateRevision(c.id, 1), c);
    assert.equal((await repo.storyById(s.id)).id, s.id);
  } finally {
    await h.close();
  }
});

test('cold job receipt lookups retain two indexed key probes as history grows', async () => {
  const h = await harness();
  try {
    const plan = await h.binding
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id,dedupe_key FROM archive_records WHERE kind='job' AND dedupe_key=? UNION ALL SELECT id,dedupe_key FROM archive_records WHERE kind='job' AND id=?",
      )
      .bind('key', 'id')
      .all<{ detail: string }>();
    const detail = plan.results.map((x) => x.detail).join(' ');
    assert.match(detail, /kind=\? AND dedupe_key=\?/);
    assert.match(detail, /kind=\? AND id=\?/);
    await h.jobs.enqueue({
      id: 'indexed',
      jobType: 'SYNTHETIC',
      idempotencyKey: 'key',
      availableAt: NOW,
      ownerEpoch: 1,
      payload: { synthetic: true },
    });
    assert.equal(h.db.measurements.find((x) => x.label === 'job.cold-receipt')!.rowsRead, 0);
  } finally {
    await h.close();
  }
});
