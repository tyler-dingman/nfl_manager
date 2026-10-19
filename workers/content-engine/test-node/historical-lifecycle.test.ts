import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  Storage,
  objectKey,
  type SqlDatabase,
  type Objects,
  ApplicationDocuments,
} from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { expireDerivedDirectories } from '../../../packages/storage/derived-lifecycle';
import { collectPayloadGarbage } from '../../../packages/storage/garbage-collection';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { harness } from '../test/harness';
import type { StoryView } from '../../../src/features/story-engine/public-story';
const out = '../../reports/historical-lifecycle';
function noise(seed: number, n: number) {
  let x = seed;
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    b[i] = x & 255;
  }
  return b.toString('base64');
}
const story = (id: string, body: string, version = 1): StoryView => ({
  id,
  teamId: 'KC',
  storyType: 'NEWS',
  headline: `Verified article ${id} correction ${version}`,
  shortSummary: 'Original attribution retained',
  whatHappened: body,
  whyItMatters: 'Historical significance',
  whatsNext: 'Follow original sources',
  status: 'CONFIRMED',
  importanceScore: 80,
  confidenceScore: 95,
  firstReportedAt: new Date(1000).toISOString(),
  lastMeaningfulUpdateAt: new Date(version * 1000).toISOString(),
  sources: [
    {
      id: 'original-source',
      name: 'Original source',
      url: 'https://example.invalid/original',
      publishedAt: new Date(1000).toISOString(),
      official: true,
      original: true,
    },
  ],
  primarySource: null,
  version,
});
const fresh = (db: SqlDatabase, metrics = requestMetrics()) =>
  new Storage(db, new D1Objects(instrumentDatabase(db, metrics)));
test(
  'editorial body sharing retains 160 published versions, search and saved IDs through verified GC',
  { timeout: 120000 },
  async () => {
    const results: any = {
      scope:
        'synthetic editorial fixture; 40 articles, four corrections each, 12KB incompressible unchanged body per article; not annual production composition',
    };
    for (const legacy of [true, false]) {
      const h = await harness(false, true, 999, undefined, false);
      try {
        const db = h.binding as unknown as SqlDatabase,
          objects = new D1Objects(db);
        const legacyObjects: Objects = {
          get: objects.get.bind(objects),
          putImmutable: objects.putImmutable.bind(objects),
          transactionDatabase: objects.transactionDatabase.bind(objects),
        };
        const s = new Storage(db, legacy ? legacyObjects : objects),
          editorial = new PublicEditorial(s);
        for (let i = 0; i < 40; i++)
          for (let v = 1; v <= 4; v++)
            await editorial.publish(story('original-' + i, noise(i + 1, 12000), v), 'PUBLISHED');
        const bytes = await db
          .prepare('SELECT sum(bytes) AS encoded,count(*) AS objects FROM app_payload_objects')
          .first<any>();
        results[legacy ? 'before' : 'after'] = bytes;
        if (!legacy) {
          const metrics = requestMetrics(),
            reader = new PublicEditorial(fresh(db, metrics));
          const page = await reader.list('KC', 200);
          assert.equal(page.length, 40);
          assert(metrics.statements < 30, JSON.stringify(metrics));
          results.listMetrics = { ...metrics };
          for (let i = 0; i < 40; i++) {
            const event = {
              id: 'wire-' + i,
              eventType: 'StoryCreated',
              storyId: 'original-' + i,
              storyVersion: 4,
              occurredAt: new Date(4000).toISOString(),
              payload: {},
            };
            const hash = await s.put(event);
            await s
              .statement(
                'INSERT INTO app_public_wire(id,event_type,story_id,team_id,story_version,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?)',
                [event.id, event.eventType, event.storyId, 'KC', 4, hash, 4000],
              )
              .run();
          }
          const wireMetrics = requestMetrics();
          await new PublicEditorial(fresh(db, wireMetrics)).wire('KC', 20);
          assert(wireMetrics.statements < 30, JSON.stringify(wireMetrics));
          results.wireMetrics = { ...wireMetrics };
          for (let i = 0; i < 40; i++)
            for (let v = 1; v <= 4; v++) {
              const old = await reader.version('original-' + i, v);
              assert.equal(old?.whatHappened, noise(i + 1, 12000));
              assert.equal(old?.sources[0].url, 'https://example.invalid/original');
              assert.equal(old?.version, v);
            }
          await s
            .statement(
              "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','synthetic@example.invalid','ACTIVE',1,1)",
            )
            .run();
          await s
            .statement(
              "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES('saved-original','owner','ARTICLE','original-0','Original','{}',1)",
            )
            .run();
          assert.equal(
            (await s.rows('SELECT id FROM app_search WHERE app_search MATCH ?', ['correction']))
              .length,
            40,
          );
          await s.put({ failedIntermediate: 'not a source or publication' });
          await collectPayloadGarbage(db, {
            dryRun: false,
            limit: 500,
            acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
          });
          const restored = new PublicEditorial(fresh(db));
          assert.equal((await restored.version('original-0', 1))?.whatHappened, noise(1, 12000));
          assert.equal((await restored.get('original-0'))?.version, 4);
          assert.equal(
            (
              await db
                .prepare("SELECT content_id FROM app_saved_content WHERE id='saved-original'")
                .first<any>()
            ).content_id,
            'original-0',
          );
        }
      } finally {
        await h.close();
      }
    }
    assert(results.after.encoded < results.before.encoded * 0.5, JSON.stringify(results));
    await mkdir(out, { recursive: true });
    await writeFile(out + '/editorial-benchmark.json', JSON.stringify(results, null, 2) + '\n');
  },
);
test(
  '200 historical odds generations remain exact below 30 read statements, including chunked and corrupt payloads',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = fresh(db),
        board = new D1OddsBoard(s);
      const event = {
        providerEventId: 'original-event',
        season: 2026,
        week: 1,
        homeTeamId: 'KC',
        awayTeamId: 'SEA',
        kickoffAt: new Date(3000000000000),
        status: 'SCHEDULED',
      };
      for (let i = 0; i < 200; i++)
        await board.publish(
          event,
          [
            {
              id: 'original-market',
              normalizedKey: 'original-market-key',
              playerId: 'original-player',
              marketType: 'PASS_YARDS',
              side: 'OVER',
              sportsbook: 'original-book',
              period: 'game',
              isAltLine: false,
              available: true,
              line: 250.5,
              odds: -100 - i,
              details: noise(42, 100),
            },
          ],
          1000 + i,
          'original-event-id',
        );
      const metrics = requestMetrics();
      const history = await new D1OddsBoard(fresh(db, metrics)).priceHistory(
        'original-event-id',
        new Date(2000).toISOString(),
      );
      assert.equal(history.length, 200);
      assert.equal(history[0].odds, -100);
      assert.equal(history.at(-1).odds, -299);
      assert(history.every((row) => row.marketId === 'original-market'));
      assert(metrics.statements < 30, JSON.stringify(metrics));
      const largeEvent = { ...event, providerEventId: 'large-original-event' };
      const markets = Array.from({ length: 2000 }, (_, i) => ({
        id: 'market-' + i,
        normalizedKey: 'key-' + i,
        playerId: 'player-' + i,
        marketType: 'PASS_YARDS',
        side: 'OVER',
        sportsbook: 'original-book',
        period: 'game',
        isAltLine: false,
        available: true,
        line: 200 + i,
        odds: -110,
        deeplink: 'https://example.invalid/' + noise(i + 1, 20),
      }));
      for (let i = 0; i < 32; i++)
        await board.publish(
          largeEvent,
          markets.map((m) => ({ ...m, odds: m.odds - i })),
          3000 + i,
          'large-original-event-id',
        );
      const largeMetrics = requestMetrics();
      const largeHistory = await new D1OddsBoard(fresh(db, largeMetrics)).priceHistory(
        'large-original-event-id',
        new Date(4000).toISOString(),
      );
      assert.equal(largeHistory.length, 64000);
      assert(largeMetrics.statements < 30, JSON.stringify(largeMetrics));
      // Independent large/chunked objects, rather than only small inline fixtures.
      const hashes = [];
      for (let i = 0; i < 20; i++) hashes.push(await s.put({ body: noise(100 + i, 50000) }));
      const bulk = requestMetrics(),
        objects = new D1Objects(instrumentDatabase(db, bulk));
      await objects.prefetch(hashes.map(objectKey));
      for (const hash of hashes) assert(await objects.get(objectKey(hash)));
      assert(bulk.statements < 5, JSON.stringify(bulk));
      await db
        .prepare(
          'UPDATE app_payload_chunks SET data=zeroblob(length(data)) WHERE hash=? AND ordinal=0',
        )
        .bind(hashes[0])
        .run();
      const corrupt = new D1Objects(db);
      await corrupt.prefetch([objectKey(hashes[0])]);
      await assert.rejects(corrupt.get(objectKey(hashes[0])));
      await mkdir(out, { recursive: true });
      await writeFile(
        out + '/odds-benchmark.json',
        JSON.stringify(
          {
            generations: 200,
            historyRows: history.length,
            metrics,
            chunkedBulkMetrics: bulk,
            representativeHistory: {
              generations: 32,
              marketsPerGeneration: 2000,
              rows: largeHistory.length,
              metrics: largeMetrics,
            },
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'bounded lifecycle resumes eligible queue, protects leases and references, and rolls audit back on failure',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = fresh(db),
        hash = await s.put({ savedEvidence: 'permanent' });
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          hash,
          'required saved evidence',
        ])
        .run();
      for (let i = 0; i < 45; i++)
        await s
          .statement(
            'INSERT INTO app_ai_cache(cache_key,object_hash,source_version,expires_at,lease_until) VALUES(?,?,?,1,0)',
            ['expired-' + i, hash, 'original'],
          )
          .run();
      await s
        .statement(
          "INSERT INTO app_ai_cache(cache_key,object_hash,source_version,expires_at,lease_until) VALUES('active',?,'original',10000,0),('leased',?,'original',1,10000)",
          [hash, hash],
        )
        .run();
      const metrics = requestMetrics();
      const one = await expireDerivedDirectories(fresh(db, metrics), 5000);
      assert.equal(one.expiredDerivedKeys, 20);
      assert(metrics.statements < 30);
      assert.equal((await expireDerivedDirectories(fresh(db), 5000)).expiredDerivedKeys, 20);
      assert.equal((await expireDerivedDirectories(fresh(db), 5000)).expiredDerivedKeys, 5);
      assert.equal((await expireDerivedDirectories(fresh(db), 5000)).expiredDerivedKeys, 0);
      assert.equal(
        (
          await db
            .prepare("SELECT removed FROM app_storage_lifecycle_totals WHERE policy='EXPIRED_AI'")
            .first<any>()
        ).removed,
        45,
      );
      assert.equal((await db.prepare('SELECT count(*) AS n FROM app_ai_cache').first<any>()).n, 2);
      // A broken audit constraint must roll back eligible directory deletion too.
      await db
        .prepare(
          "INSERT INTO app_ai_cache(cache_key,source_version,expires_at,lease_until) VALUES('rollback','original',1,0)",
        )
        .run();
      await db
        .prepare(
          "CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON app_storage_lifecycle_totals BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END",
        )
        .run();
      await assert.rejects(expireDerivedDirectories(fresh(db), 5000), /synthetic audit failure/);
      await db.prepare('DROP TRIGGER synthetic_audit_failure').run();
      assert(
        await db.prepare("SELECT cache_key FROM app_ai_cache WHERE cache_key='rollback'").first(),
      );
      await collectPayloadGarbage(db, {
        dryRun: false,
        limit: 500,
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
      });
      assert(await new D1Objects(db).get(objectKey(hash)));
      await mkdir(out, { recursive: true });
      await writeFile(
        out + '/lifecycle-metrics.json',
        JSON.stringify(
          { metrics, perBatchLimit: 20, pinnedEvidencePreserved: true, activeLeasePreserved: true },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await h.close();
    }
  },
);
