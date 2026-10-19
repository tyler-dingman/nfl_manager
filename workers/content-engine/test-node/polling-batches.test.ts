import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
import { PollingBatches } from '../../../packages/storage/polling-batches';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
const setup = (db: any) => new Storage(db, new D1Objects(db));
const source = (id: string): any => ({
  id,
  name: id,
  sourceType: 'LOCAL_OUTLET',
  teamId: 'KC',
  leagueWide: false,
  url: 'https://example.invalid/' + id,
  feedUrl: 'https://example.invalid/' + id + '/rss',
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
  nextCheckAt: new Date(0),
  failureCount: 0,
  lastError: null,
  metadata: { publishAll: true },
});
const empty = {
  async fetch(s: any) {
    return {
      items: [],
      notModified: true,
      etag: 'etag-' + s.id,
      lastModified: 'Mon, 19 Oct 2026 00:00:00 GMT',
    };
  },
};
async function seeded(n = 8, persistent = false) {
  const h = await harness(persistent, true, 999, undefined, false);
  for (let i = 0; i < n; i++)
    await new D1EditorialIngestion(setup(h.binding)).syncSource(source('s' + i));
  return h;
}
test(
  'eight-source batch bounds queries, intervals, validators and duplicate scheduler ownership',
  { timeout: 60000 },
  async () => {
    const h = await seeded();
    try {
      const m = requestMetrics(),
        s = setup(instrumentDatabase(h.binding, m, 50)),
        b = new PollingBatches(s);
      const leases = await Promise.all([b.claim(), new PollingBatches(setup(h.binding)).claim()]);
      assert.equal(leases.filter(Boolean).length, 1);
      const start = Date.now(),
        result = await b.step(leases.find(Boolean)!.token, empty);
      assert.equal(result.checks, 8);
      assert.equal(result.done, true);
      assert.ok(m.statements < 30, JSON.stringify(m));
      for (const r of await s.rows<any>('SELECT * FROM app_editorial_sources')) {
        assert.equal(r.etag, 'etag-' + r.id);
        assert.ok(r.next_check_at >= start + 300000);
        assert.equal(r.request_count, 1);
      }
      assert.equal((await s.rows('SELECT * FROM app_editorial_jobs')).length, 0);
      const beforeWrites = m.rowsWritten;
      assert.equal(await b.claim(), null);
      assert.equal(await new D1EditorialIngestion(s).claimJob('idle'), null);
      assert.equal(m.rowsWritten, beforeWrites, 'idle schedulers must perform zero D1 writes');
    } finally {
      await h.close();
    }
  },
);
test(
  'termination, expired lease, independent timeout and failed checkpoint transaction',
  { timeout: 60000 },
  async () => {
    const h = await seeded(2);
    try {
      const s = setup(h.binding),
        b = new PollingBatches(s),
        lease = (await b.claim())!;
      await h.binding.prepare('UPDATE app_storage_poll_batch SET expires_at=0').run();
      const replacement = (await new PollingBatches(setup(h.binding)).claim())!;
      await assert.rejects(b.step(lease.token, empty), /expired/);
      let calls = 0;
      const result = await b.step(replacement.token, {
        async fetch(x: any) {
          calls++;
          if (x.id === 's0') throw Error('source timeout');
          return empty.fetch(x);
        },
      });
      assert.equal(calls, 2);
      assert.equal(result.failures, 1);
      const [failed] = await s.rows<any>("SELECT * FROM app_editorial_sources WHERE id='s0'");
      assert.equal(failed.failure_count, 1);
      assert.match(failed.last_error, /timeout/);
      const [ok] = await s.rows<any>("SELECT * FROM app_editorial_sources WHERE id='s1'");
      assert.equal(ok.failure_count, 0);
      assert.equal(ok.request_count, 1);
      await h.binding.prepare('UPDATE app_editorial_sources SET next_check_at=0').run();
      const next = (await b.claim())!;
      await h.binding.exec(
        "CREATE TRIGGER reject_checkpoint BEFORE UPDATE ON app_editorial_sources BEGIN SELECT RAISE(ABORT,'injected database failure'); END",
      );
      await assert.rejects(b.step(next.token, empty), /injected database failure/);
      assert.equal(
        (await s.rows<any>('SELECT next_check_at FROM app_editorial_sources')).every(
          (r) => r.next_check_at === 0,
        ),
        true,
      );
      assert.equal(
        (await s.rows<any>('SELECT token FROM app_storage_poll_batch'))[0].token,
        next.token,
      );
      await h.binding.exec('DROP TRIGGER reject_checkpoint');
      await new PollingBatches(setup(h.binding)).step(next.token, empty);
      assert.equal(
        (await s.rows<any>('SELECT request_count FROM app_editorial_sources')).every(
          (r) => r.request_count === 2,
        ),
        true,
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'durable inbox survives restart and repairs interrupted candidate job with original attribution',
  { timeout: 60000 },
  async () => {
    const h = await seeded(1, true);
    try {
      let db = h.binding;
      let s = setup(db);
      const b = new PollingBatches(s),
        token = (await b.claim())!.token;
      const item: any = {
        sourceId: 's0',
        externalId: 'original-item-id',
        url: 'https://example.invalid/article',
        title: 'Kansas City signs quarterback Jordan Example to contract',
        author: 'Original source',
        publishedAt: new Date().toISOString(),
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
        rawText: 'The Chiefs signed quarterback Jordan Example to a contract. '.repeat(40),
        excerpt: 'Chiefs quarterback signing confirmed.',
        categories: [],
        media: [],
      };
      assert.equal(
        (
          await b.step(token, {
            async fetch() {
              return { items: [item, item], etag: 'v2', lastModified: null, notModified: false };
            },
          })
        ).done,
        false,
      );
      assert.equal(
        (await s.rows<any>('SELECT request_count FROM app_editorial_sources'))[0].request_count,
        0,
      );
      db = await h.restart();
      s = setup(db);
      await db.prepare('UPDATE app_storage_poll_batch SET expires_at=0').run();
      const restarted = new PollingBatches(setup(db)),
        recovered = (await restarted.claim())!;
      assert.equal((await restarted.read(recovered.token)).results[0].items.length, 2);
      const run = () =>
        withApplicationBindings(
          {
            db: db,
            objects: new D1Objects(db),
            env: { APP_DATA_BACKEND: 'd1', APP_OBJECT_BACKEND: 'd1', OBSERVER_MODE: 'true' },
          },
          () => restarted.step(recovered.token),
        );
      assert.equal((await run()).done, false);
      await db.prepare('DELETE FROM app_editorial_jobs').run();
      assert.equal((await run()).done, true);
      const candidates = await s.rows<any>('SELECT * FROM app_editorial_candidates');
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].source_id, 's0');
      const jobs = await s.rows<any>('SELECT * FROM app_editorial_jobs');
      assert.equal(jobs.length, 1);
      assert.equal(JSON.parse(jobs[0].payload).candidateId, candidates[0].id);
      assert.equal(
        (await new D1EditorialIngestion(s).candidateById(candidates[0].id))!.author,
        'Original source',
      );
      assert.equal((await s.rows<any>('SELECT etag FROM app_editorial_sources'))[0].etag, 'v2');
      assert.equal((await s.rows('SELECT * FROM app_storage_poll_batch')).length, 0);
      await db.prepare('DELETE FROM app_editorial_jobs').run();
      await db.prepare('UPDATE app_editorial_sources SET next_check_at=0').run();
      const retry = (await restarted.claim())!;
      assert.equal(
        (
          await restarted.step(retry.token, {
            async fetch() {
              return {
                items: [{ ...item, url: item.url + '?utm_source=revisit' }],
                etag: 'v3',
                lastModified: null,
                notModified: false,
              };
            },
          })
        ).done,
        true,
      );
      assert.equal((await s.rows('SELECT id FROM app_editorial_candidates')).length, 1);
      assert.equal((await s.rows('SELECT id FROM app_editorial_jobs')).length, 1);
    } finally {
      await h.close();
    }
  },
);
test(
  'failed item processing retains evidence separately while healthy source checkpoints advance',
  { timeout: 60000 },
  async () => {
    const h = await seeded(2);
    try {
      const s = setup(h.binding),
        b = new PollingBatches(s),
        lease = (await b.claim())!;
      const item: any = {
        sourceId: 's0',
        externalId: 'retry-item',
        url: 'https://example.invalid/retry',
        title: 'Chiefs sign quarterback Jordan Example',
        author: 'Attribution',
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        rawText: 'The Chiefs signed quarterback Jordan Example. '.repeat(40),
        excerpt: 'The Chiefs signing is confirmed.',
        categories: [],
        media: [],
      };
      await b.step(lease.token, {
        async fetch(x: any) {
          return {
            items: x.id === 's0' ? [item] : [],
            etag: 'latest-' + x.id,
            lastModified: null,
            notModified: x.id !== 's0',
          };
        },
      });
      await h.binding.exec(
        "CREATE TRIGGER reject_candidate BEFORE INSERT ON app_editorial_candidates BEGIN SELECT RAISE(ABORT,'injected item failure'); END",
      );
      const step = (token: string) =>
        withApplicationBindings(
          {
            db: h.binding,
            objects: new D1Objects(h.binding),
            env: { APP_DATA_BACKEND: 'd1', APP_OBJECT_BACKEND: 'd1', OBSERVER_MODE: 'true' },
          },
          () => new PollingBatches(setup(h.binding)).step(token),
        );
      assert.equal((await step(lease.token)).done, true);
      const [retry] = await s.rows<any>('SELECT * FROM app_storage_poll_retry');
      assert.equal(JSON.parse(retry.payload).items[0].author, 'Attribution');
      const [healthy] = await s.rows<any>("SELECT * FROM app_editorial_sources WHERE id='s1'");
      assert.equal(healthy.request_count, 1);
      assert.equal(healthy.failure_count, 0);
      const [failed] = await s.rows<any>("SELECT * FROM app_editorial_sources WHERE id='s0'");
      assert.equal(failed.failure_count, 1);
      assert.equal(failed.etag, null);
      await h.binding.exec('DROP TRIGGER reject_candidate');
      await h.binding
        .prepare("UPDATE app_editorial_sources SET next_check_at=0 WHERE id='s0'")
        .run();
      const recovered = (await new PollingBatches(setup(h.binding)).claim())!;
      await new PollingBatches(setup(h.binding)).step(recovered.token, {
        async fetch() {
          throw Error('must use durable original evidence');
        },
      });
      assert.equal((await step(recovered.token)).done, true);
      assert.equal((await s.rows('SELECT * FROM app_storage_poll_retry')).length, 0);
      assert.equal(
        (await s.rows<any>('SELECT source_id FROM app_editorial_candidates'))[0].source_id,
        's0',
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'large simultaneous feeds use independent bounded inbox rows rather than one oversized batch row',
  { timeout: 60000 },
  async () => {
    const h = await seeded();
    try {
      const s = setup(h.binding),
        b = new PollingBatches(s),
        m = requestMetrics(),
        token = (await b.claim())!.token;
      const measured = new PollingBatches(setup(instrumentDatabase(h.binding, m, 50)));
      const result = await measured.step(token, {
        async fetch(x: any) {
          return {
            items: [
              {
                sourceId: x.id,
                externalId: x.id,
                url: 'https://example.invalid/' + x.id + '/large',
                title: 'Original article',
                author: 'Original publisher',
                publishedAt: new Date().toISOString(),
                rawText: 'x'.repeat(250000),
                excerpt: 'Original',
                categories: [],
                media: [],
              } as any,
            ],
            etag: x.id,
            lastModified: null,
            notModified: false,
          };
        },
      });
      assert.equal(result.done, false);
      assert.ok(m.statements <= 50);
      const inbox = await s.rows<any>('SELECT length(payload) bytes FROM app_storage_poll_retry');
      assert.equal(inbox.length, 8);
      assert.ok(inbox.every((r) => r.bytes > 250000 && r.bytes < 1900000));
      assert.ok(
        (await s.rows<any>('SELECT length(payload) bytes FROM app_storage_poll_batch'))[0].bytes <
          10000,
      );
      const recovered = await new PollingBatches(setup(h.binding)).read(token);
      assert.equal(
        recovered.results.reduce((n: number, r: any) => n + r.items[0].rawText.length, 0),
        2000000,
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'concurrent stale candidate processing cannot publish two canonical articles',
  { timeout: 60000 },
  async () => {
    const h = await seeded(1);
    try {
      const s = setup(h.binding),
        r = new D1EditorialIngestion(s),
        src = await r.sourceById('s0');
      const candidate: any = {
        id: 'original-candidate',
        sourceId: 's0',
        externalId: 'original',
        url: 'https://example.invalid/original',
        title: 'Original article',
        normalizedTitle: 'original article',
        author: 'Original author',
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        text: 'Original supported facts',
        excerpt: 'Original evidence',
        entities: [],
        candidateTeams: ['KC'],
        fingerprint: 'original-fingerprint',
        status: 'NEW',
        storyType: 'ANALYSIS',
      };
      await r.saveCandidate(candidate);
      const synth: any = {
        headline: 'Original article',
        summary: 'Original summary',
        whatHappened: 'Original facts',
        whyItMatters: 'Original context',
        whatsNext: 'Original next',
        status: 'DEVELOPING',
        importanceScore: 80,
        confidenceScore: 95,
        claims: [],
      };
      const results = await Promise.allSettled([
        r.createStory(candidate, src!, synth, 'PUBLISHED', 'NEW_FACT'),
        new D1EditorialIngestion(setup(h.binding)).createStory(
          candidate,
          src!,
          synth,
          'PUBLISHED',
          'NEW_FACT',
        ),
      ]);
      assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(results.filter((x) => x.status === 'rejected').length, 1);
      assert.equal((await s.rows('SELECT id FROM app_editorial_stories')).length, 1);
      assert.equal((await s.rows('SELECT id FROM app_editorial_evidence')).length, 1);
      assert.equal((await r.candidateById(candidate.id))!.status, 'CLUSTERED');
    } finally {
      await h.close();
    }
  },
);
