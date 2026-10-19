import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, digest, utf8, objectKey, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects, StorageCapacityError } from '../../../packages/storage/d1-objects';
import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
import { collectPayloadGarbage } from '../../../packages/storage/garbage-collection';
import {
  instrumentDatabase,
  requestMetrics,
  QueryBudgetError,
} from '../../../packages/storage/instrumentation';
const setup = (binding: any) => {
  const db = binding as SqlDatabase;
  return new Storage(db, new D1Objects(db));
};
const source: any = {
  id: 'source',
  name: 'Original source',
  sourceType: 'OFFICIAL_TEAM',
  teamId: 'KC',
  leagueWide: false,
  url: 'https://example.invalid',
  feedUrl: 'https://example.invalid/rss',
  fetchStrategy: 'RSS',
  pollingTier: 'A',
  priority: 100,
  reliabilityScore: 1,
  checkIntervalSeconds: 300,
  enabled: true,
  etag: null,
  lastModified: null,
  lastCheckedAt: null,
  lastSuccessfulAt: null,
  nextCheckAt: new Date(),
  failureCount: 0,
  lastError: null,
  metadata: {},
};
test(
  'bulk preparation concurrent dedup reserves exact bytes, rejects capacity and detects corrupted objects',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const a = setup(h.binding),
        b = setup(h.binding);
      const entries = await Promise.all(
        [1, 2, 3].map(async (i) => {
          const bytes = utf8.encode(JSON.stringify({ schema: 1, value: i }));
          return { key: objectKey(await digest(bytes)), bytes };
        }),
      );
      await Promise.all([
        a.objects.putManyImmutable!(entries),
        b.objects.putManyImmutable!(entries),
      ]);
      const [used] = await a.rows<any>(
        'SELECT used_bytes,(SELECT sum(bytes) FROM app_payload_objects) actual FROM app_payload_capacity WHERE id=1',
      );
      assert.equal(used.used_bytes, used.actual);
      assert.equal((await a.rows<any>('SELECT count(*) n FROM app_payload_objects'))[0].n, 3);
      await h.binding
        .prepare('UPDATE app_payload_capacity SET used_bytes=64000000 WHERE id=1')
        .run();
      const bytes = utf8.encode(JSON.stringify({ new: 'must-not-publish' })),
        key = objectKey(await digest(bytes));
      await assert.rejects(
        setup(h.binding).objects.putManyImmutable!([{ key, bytes }]),
        StorageCapacityError,
      );
      assert.equal(await setup(h.binding).objects.get(key), null);
      await h.binding
        .prepare('UPDATE app_payload_objects SET inline_data=? WHERE hash=?')
        .bind(new Uint8Array([1, 2, 3]), entries[0].key.split('/').at(-1))
        .run();
      await assert.rejects(setup(h.binding).objects.putManyImmutable!([entries[0]]));
    } finally {
      await h.close();
    }
  },
);
test(
  'canonical bodies share across corrections; all original revisions and attribution restore without R2',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false),
      restored = await harness(false, true, 999, undefined, false);
    try {
      const s = setup(h.binding),
        r = new D1EditorialIngestion(s);
      await r.syncSource(source);
      const text = Array.from(
        { length: 2000 },
        (_, i) => `${i.toString(36)} synthetic original field ${i * 7919}`,
      ).join(' ');
      const candidate: any = {
        id: 'candidate',
        sourceId: source.id,
        externalId: 'external',
        url: 'https://example.invalid/story',
        title: 'Original',
        normalizedTitle: 'original',
        author: 'Original author',
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        text,
        excerpt: 'Original excerpt',
        entities: ['Chiefs'],
        candidateTeams: ['KC'],
        fingerprint: 'fingerprint',
        status: 'NEW',
        storyType: 'ANALYSIS',
      };
      await r.saveCandidate(candidate);
      const synth: any = {
        headline: 'Original headline',
        summary: 'Original summary',
        whatHappened: text,
        whyItMatters: 'Original context',
        whatsNext: 'Original next',
        status: 'DEVELOPING',
        importanceScore: 80,
        confidenceScore: 95,
        claims: [{ text: 'Original claim', sourceEvidenceIds: ['candidate'], confidence: 95 }],
      };
      const id = await r.createStory(candidate, source, synth, 'PUBLISHED', 'NEW_FACT');
      const originals = [await r.storyById(id)];
      for (let n = 2; n <= 3; n++) {
        await r.promoteExistingStory(
          originals.at(-1)!,
          {
            ...synth,
            headline: 'Correction ' + n,
            ...(n === 3 ? { whatHappened: text + ' Corrected source fact.' } : {}),
          },
          {
            action: 'AUTO_PUBLISH',
            reason: 'Verified correction',
            confidence: 95,
            breaking: false,
          },
        );
        originals.push(await r.storyById(id));
      }
      const head = (
        await s.rows<any>('SELECT object_hash FROM app_editorial_stories WHERE id=?', [id])
      )[0];
      const packed = await s.get<any>(head.object_hash);
      assert.equal(packed.schema, 2);
      for (let n = 1; n <= 3; n++) {
        const revision = await r.revisionByVersion(id, n);
        assert.deepEqual(revision.story, originals[n - 1]);
        assert.deepEqual(
          revision.synth,
          n === 1
            ? synth
            : {
                ...synth,
                headline: 'Correction ' + n,
                ...(n === 3 ? { whatHappened: text + ' Corrected source fact.' } : {}),
              },
        );
      }
      // Full fixture application graph copied to a second synthetic D1, preserving
      // original IDs, binary chunks and FTS row IDs. Owner restore, not an HTTP path.
      const tables = [
        'app_storage_epoch',
        'app_payload_capacity',
        'app_payload_objects',
        'app_payload_chunks',
        'app_editorial_sources',
        'app_editorial_candidates',
        'app_editorial_stories',
        'app_editorial_evidence',
        'app_editorial_versions',
        'app_editorial_decisions',
        'app_editorial_events',
        'app_public_stories',
        'app_public_story_versions',
        'app_public_wire',
        'app_search',
      ];
      for (const table of tables) {
        const rows = (
          await h.binding
            .prepare(`SELECT ${table === 'app_search' ? 'rowid,*' : '*'} FROM ${table}`)
            .all()
        ).results;
        for (const row of rows) {
          const keys = Object.keys(row);
          await restored.binding
            .prepare(
              `INSERT INTO ${table}(${keys.map((k) => '"' + k + '"').join(',')}) VALUES(${keys.map(() => '?').join(',')})`,
            )
            .bind(...keys.map((k) => row[k]))
            .run();
        }
      }
      const restoredStorage = setup(restored.binding);
      await restoredStorage.put({ schema: 1, postRestore: 'write capacity remains correct' });
      const [capacity] = await restoredStorage.rows<any>(
        'SELECT used_bytes,(SELECT sum(bytes) FROM app_payload_objects) actual FROM app_payload_capacity WHERE id=1',
      );
      assert.equal(capacity.used_bytes, capacity.actual);
      const restoredRepo = new D1EditorialIngestion(setup(restored.binding));
      for (let n = 1; n <= 3; n++)
        assert.deepEqual((await restoredRepo.revisionByVersion(id, n)).story, originals[n - 1]);
      assert.equal((await restoredRepo.evidenceForStory(id))[0].candidate.url, candidate.url);
      assert.equal(
        (await restored.binding.prepare('PRAGMA foreign_key_check').all()).results.length,
        0,
      );
      const mark = await collectPayloadGarbage(h.binding as any, {
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
        dryRun: true,
      });
      assert.equal(mark.deletedObjects, 0);
      assert.deepEqual(
        (await new D1EditorialIngestion(setup(h.binding)).revisionByVersion(id, 1)).story,
        originals[0],
      );
      const fresh = new D1EditorialIngestion(setup(h.binding));
      await fresh.syncSource({ ...source, id: 'other-source' });
      await h.binding
        .prepare(
          "UPDATE app_editorial_candidates SET source_id='other-source' WHERE id='candidate'",
        )
        .run();
      await assert.rejects(fresh.evidenceForStory(id), /identity mismatch/);
    } finally {
      await h.close();
      await restored.close();
    }
  },
);
test(
  'registry clock revisits do not rewrite definitions or reset polling validators',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const r = new D1EditorialIngestion(setup(h.binding));
      await r.syncSource(source);
      await r.markSourceSuccess(
        source,
        'original-etag',
        'original-modified',
        new Date(Date.now() + 300000),
        5,
      );
      const before = await r.sourceById(source.id),
        metrics = requestMetrics(),
        db = instrumentDatabase(h.binding as any, metrics);
      await new D1EditorialIngestion(new Storage(db, new D1Objects(db))).syncSource({
        ...source,
        nextCheckAt: new Date(Date.now() + 900000),
      });
      assert.equal(metrics.rowsWritten, 0);
      const after = await r.sourceById(source.id);
      assert.equal(after?.etag, before?.etag);
      assert.deepEqual(after?.nextCheckAt, before?.nextCheckAt);
      await h.binding
        .prepare('UPDATE app_editorial_sources SET priority=0 WHERE id=?')
        .bind(source.id)
        .run();
      await r.syncSource(source);
      assert.equal(
        (
          await h.binding
            .prepare('SELECT priority FROM app_editorial_sources WHERE id=?')
            .bind(source.id)
            .first<any>()
        )?.priority,
        source.priority,
      );
      await r.syncSource({ ...source, name: 'Corrected source name' });
      assert.equal((await r.sourceById(source.id))?.name, 'Corrected source name');
    } finally {
      await h.close();
    }
  },
);
test(
  'combined publication guard rejects a raced public version and preserves FTS atomically',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const { PublicEditorial } = await import('../../../packages/storage/editorial');
      const { guardedBatch } = await import('../../../packages/storage/atomic');
      const s = setup(h.binding),
        pub = new PublicEditorial(s),
        base: any = {
          id: 'raced-story',
          teamId: 'KC',
          storyType: 'ANALYSIS',
          headline: 'Original version',
          shortSummary: 'Original',
          whatHappened: 'Original evidence',
          whyItMatters: 'Original context',
          whatsNext: 'Original next',
          status: 'DEVELOPING',
          importanceScore: 80,
          confidenceScore: 95,
          firstReportedAt: new Date().toISOString(),
          lastMeaningfulUpdateAt: new Date().toISOString(),
          sources: [
            {
              id: 'source',
              name: 'Original source',
              url: 'https://example.invalid/source',
              publishedAt: new Date().toISOString(),
              official: true,
              original: true,
            },
          ],
          primarySource: null,
          version: 1,
        };
      await pub.publish(base, 'PUBLISHED');
      const guards: any[] = [];
      const pending = await pub.prepare(
        { ...base, headline: 'Stale correction', version: 2 },
        'PUBLISHED',
        undefined,
        guards,
      );
      await pub.publish({ ...base, headline: 'Winner correction', version: 3 }, 'PUBLISHED');
      await assert.rejects(guardedBatch(s, guards, pending));
      assert.equal((await pub.get(base.id))?.headline, 'Winner correction');
      assert.equal(
        (await s.rows("SELECT * FROM app_search WHERE app_search MATCH 'Winner'")).length,
        1,
      );
      assert.equal(
        (await s.rows("SELECT * FROM app_search WHERE app_search MATCH 'Stale'")).length,
        0,
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'shared invocation budget rejects oversized batches before any mutation and concurrent reads cannot exceed the limit',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const m = requestMetrics(),
        db = instrumentDatabase(h.binding as any, m, 5);
      await assert.rejects(
        db.batch(
          Array.from({ length: 6 }, () =>
            db.prepare(
              "INSERT INTO app_application_settings(key,value_json,version) VALUES('must-not-exist','{}',1)",
            ),
          ),
        ),
        QueryBudgetError,
      );
      assert.equal(m.statements, 0);
      await db.batch(Array.from({ length: 4 }, () => db.prepare('SELECT 1')));
      const outcomes = await Promise.allSettled(
        Array.from({ length: 3 }, () => db.prepare('SELECT 1').all()),
      );
      assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(m.statements, 5);
      assert.equal(
        (
          await h.binding
            .prepare("SELECT count(*) n FROM app_application_settings WHERE key='must-not-exist'")
            .first<any>()
        )?.n,
        0,
      );
    } finally {
      await h.close();
    }
  },
);
