import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import {
  frozenTables,
  snapshotDigest,
  planApprovedRetention,
  publishRetentionPlan,
} from '../../../packages/storage/approved-retention';
import { collectPayloadGarbage } from '../../../packages/storage/garbage-collection';
import { mkdir, writeFile } from 'node:fs/promises';
import type { StoryView } from '../../../src/features/story-engine/public-story';
const DAY = 86400000,
  now = Date.now();
function story(id: string, days: number, version = 1): StoryView {
  return {
    id,
    teamId: 'KC',
    storyType: 'NEWS',
    headline: `Retained original ${id} correction ${version}`,
    shortSummary: 'Original attribution',
    whatHappened: 'Original source evidence',
    whyItMatters: 'Original relevance',
    whatsNext: 'Follow sources',
    status: 'CONFIRMED',
    importanceScore: 80,
    confidenceScore: 95,
    firstReportedAt: new Date(now - days * DAY).toISOString(),
    lastMeaningfulUpdateAt: new Date(now - days * DAY).toISOString(),
    sources: [
      {
        id: 'source',
        name: 'Original source',
        url: 'https://example.invalid/source',
        publishedAt: new Date(now - days * DAY).toISOString(),
        official: true,
        original: true,
      },
    ],
    primarySource: null,
    version,
  };
}
test(
  'approved policy boundaries, saved/cross references, published corrections, archive gate and bounded private workerd steps',
  { timeout: 120000 },
  async () => {
    const script = (
      await build({
        stdin: {
          contents: `import {retentionStep} from '../../packages/storage/approved-retention';import {instrumentDatabase,requestMetrics} from '../../packages/storage/instrumentation';export default {async fetch(r,e){if(r.headers.get('authorization')!=='Bearer synthetic-owner')return new Response(null,{status:401});const metrics=requestMetrics();const result=await retentionStep(instrumentDatabase(e.EDITORIAL_DB,metrics),await r.text(),'OWNER_PRIVATE_MAINTENANCE');return Response.json({result,metrics});}}`,
          resolveDir: process.cwd(),
        },
        bundle: true,
        format: 'esm',
        platform: 'browser',
        write: false,
      })
    ).outputFiles[0].text;
    const h = await harness(true, true, 999, script, false);
    try {
      let db = h.binding as unknown as SqlDatabase;
      const s = new Storage(db, new D1Objects(db)),
        pub = new PublicEditorial(s);
      await s
        .statement(
          "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','owner@example.invalid','ACTIVE',1,1)",
        )
        .run();
      for (const age of [6, 7, 29, 30, 89, 90, 91]) {
        await pub.publish(story('published-' + age, age), 'PUBLISHED');
        await pub.publish(story('draft-' + age, age), 'DRAFT');
        await s
          .statement(
            'INSERT INTO app_daily_briefings(id,team_id,briefing_date,generated_at,published_at,object_hash) VALUES(?,?,?,?,?,?)',
            [
              'brief-' + age,
              'KC',
              new Date(now - age * DAY).toISOString().slice(0, 10),
              now - age * DAY,
              now - age * DAY,
              await s.put({ id: 'brief-' + age }),
            ],
          )
          .run();
      }
      await pub.publish(story('saved-original-91', 91), 'PUBLISHED');
      await pub.publish(story('saved-original-91', 91, 2), 'PUBLISHED');
      const savedHash = await s.put({ articleId: 'saved-original-91', marketId: 'saved-market' });
      await s
        .statement(
          "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,metadata_hash,created_at) VALUES('saved','owner','ARTICLE','saved-original-91','Original','{}',?,1)",
          [savedHash],
        )
        .run();
      const board = new D1OddsBoard(s);
      for (const age of [29, 30, 91]) {
        const input = {
          providerEventId: 'event-' + age,
          season: 2026,
          week: 1,
          homeTeamId: 'KC',
          awayTeamId: 'SEA',
          kickoffAt: new Date(now - (age + 1) * DAY),
          status: 'FINAL',
        };
        await board.publish(
          input,
          [
            {
              id: 'market-' + age,
              normalizedKey: 'key-' + age,
              marketType: 'PASS_YARDS',
              side: 'OVER',
              sportsbook: 'original-book',
              playerId: 'original-player',
              period: 'game',
              isAltLine: false,
              available: true,
              line: 250.5,
              odds: -110,
            },
          ],
          now - age * DAY,
          'event-id-' + age,
        );
      }
      await board.publish(
        {
          providerEventId: 'saved-event',
          season: 2026,
          week: 1,
          homeTeamId: 'KC',
          awayTeamId: 'SEA',
          kickoffAt: new Date(now - 100 * DAY),
          status: 'FINAL',
        },
        [
          {
            id: 'saved-market',
            normalizedKey: 'saved-key',
            marketType: 'PASS_YARDS',
            side: 'OVER',
            sportsbook: 'original-book',
            playerId: 'original-player',
            period: 'game',
            isAltLine: false,
            available: true,
            line: 251.5,
            odds: -111,
          },
        ],
        now - 91 * DAY,
        'saved-event-id',
      );
      await s
        .statement(
          "INSERT INTO app_editorial_sources(id,name,team_id,league_wide,source_type,polling_tier,priority,enabled,object_hash,next_check_at,updated_at) VALUES('candidate-source','Original','KC',0,'RSS','A',1,1,?,1,1)",
          [await s.put({ sourceId: 'candidate-source' })],
        )
        .run();
      for (const age of [6, 7, 91]) {
        const id = 'processed-candidate-' + age;
        await s
          .statement(
            "INSERT INTO app_editorial_candidates(id,source_id,external_id,canonical_url,fingerprint,published_at,discovered_at,teams,status,object_hash) VALUES(?,'candidate-source',?,?,?,1,1,'[]','REJECTED',?)",
            [
              id,
              id,
              'https://example.invalid/' + id,
              'fingerprint-' + id,
              await s.put({ id, evidence: 'Original required attribution' }),
            ],
          )
          .run();
        await s
          .statement(
            "INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,status,available_at,created_at,updated_at) VALUES(?,'CANDIDATE_PROCESS',?,?,'COMPLETED',1,1,?)",
            ['job-' + id, 'job-' + id, JSON.stringify({ candidateId: id }), now - age * DAY],
          )
          .run();
      }
      const candidatePin = await s.put({ requiredCandidate: 'processed-candidate-91' });
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          candidatePin,
          'Retained source evidence',
        ])
        .run();
      // A retained article references an otherwise expired article transitively.
      const reference = await s.put({ requiredArticle: 'published-91' });
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          reference,
          'recovery inventory',
        ])
        .run();
      await db.prepare('UPDATE app_storage_epoch SET epoch=epoch+1,locked=1 WHERE id=1').run();
      const storageBefore = (
        await db.prepare('SELECT sum(bytes) AS bytes FROM app_payload_objects').first<any>()
      ).bytes;
      const frozen = await frozenTables(db),
        planned = await planApprovedRetention(frozen, now, 500);
      const selected = planned.items.map((c) => c.id);
      assert(!selected.includes('published-89'));
      assert(selected.includes('published-90'));
      assert(!selected.includes('published-91'));
      assert(!selected.includes('saved-original-91'));
      assert(!selected.includes('processed-candidate-6'));
      assert(selected.includes('processed-candidate-7'));
      assert(!selected.includes('processed-candidate-91'));
      assert(!selected.includes('draft-6'));
      assert(selected.includes('draft-7'));
      assert(!selected.includes('brief-29'));
      assert(selected.includes('brief-30'));
      assert(
        !planned.items.some((c) => c.kind === 'ODDS_HISTORY' && c.id.startsWith('saved-event-id:')),
      );
      assert(
        planned.items.some((c) => c.kind === 'ODDS_HISTORY' && c.id.startsWith('event-id-30:')),
      );
      await assert.rejects(
        publishRetentionPlan(db, frozen, { digest: 'bad', path: '', snapshotDigest: '' }, now),
        /archive receipt/,
      );
      // Library fixture models a verified owner receipt; the separate CLI integration
      // exercises real AES-GCM encryption and full SQL restore before minting it.
      const plan = await publishRetentionPlan(
        db,
        frozen,
        {
          digest: 'a'.repeat(64),
          path: '/synthetic/offline/archive',
          snapshotDigest: await snapshotDigest(frozen),
        },
        now,
        500,
      );
      assert.equal((await h.mf.dispatchFetch('http://private.test/')).status, 401);
      await assert.rejects(new Storage(db, new D1Objects(db)).put({ concurrentWriter: true }));
      const metrics: any[] = [];
      const step = async () => {
        const r = await h.mf.dispatchFetch('http://private.test/', {
          method: 'POST',
          headers: { authorization: 'Bearer synthetic-owner' },
          body: plan.runId,
        });
        assert.equal(r.status, 200);
        const body = (await r.json()) as any;
        assert(body.metrics.statements < 30, JSON.stringify(body));
        metrics.push(body.metrics);
        return body.result;
      };
      const beforeCount = (
        await db.prepare('SELECT count(*) AS n FROM app_public_stories').first<any>()
      ).n;
      await db
        .prepare(
          "CREATE TRIGGER synthetic_retention_failure BEFORE INSERT ON app_storage_retention_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END",
        )
        .run();
      const failed = await h.mf.dispatchFetch('http://private.test/', {
        method: 'POST',
        headers: { authorization: 'Bearer synthetic-owner' },
        body: plan.runId,
      });
      assert.equal(failed.status, 500);
      assert.equal(
        (await db.prepare('SELECT count(*) AS n FROM app_public_stories').first<any>()).n,
        beforeCount,
      );
      assert.equal(
        (
          await db
            .prepare('SELECT last_ordinal FROM app_storage_retention_plans WHERE id=?')
            .bind(plan.runId)
            .first<any>()
        ).last_ordinal,
        0,
      );
      await db.prepare('DROP TRIGGER synthetic_retention_failure').run();
      await step();
      db = (await h.restart()) as unknown as SqlDatabase;
      await Promise.all([step(), step()]);
      for (let i = 0; i < 100; i++) if ((await step()).done) break;
      assert((await step()).done);
      assert.equal(
        (
          await db
            .prepare('SELECT count(*) AS n FROM app_storage_retention_items WHERE run_id=?')
            .bind(plan.runId)
            .first<any>()
        ).n,
        0,
      );
      assert(
        await db
          .prepare("SELECT id FROM app_storage_candidate_receipts WHERE id='processed-candidate-7'")
          .first(),
      );
      const restored = new PublicEditorial(new Storage(db, new D1Objects(db)));
      assert.equal(await restored.get('published-90'), null);
      assert(await restored.get('published-89'));
      assert.equal((await restored.version('saved-original-91', 1))?.id, 'saved-original-91');
      assert.equal((await restored.version('saved-original-91', 2))?.version, 2);
      assert.equal(
        (await db.prepare("SELECT id FROM app_search WHERE id='published-90'").all()).results
          .length,
        0,
      );
      assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
      await collectPayloadGarbage(db, {
        dryRun: false,
        limit: 500,
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
      });
      assert(
        await new PublicEditorial(new Storage(db, new D1Objects(db))).get('saved-original-91'),
      );
      await mkdir('../../reports/approved-retention', { recursive: true });
      await writeFile(
        '../../reports/approved-retention/boundaries-runtime.json',
        JSON.stringify(
          {
            boundaries: [6, 7, 29, 30, 89, 90, 91],
            planned: plan,
            maximumStepStatements: Math.max(...metrics.map((m) => m.statements)),
            permanentSavedArticleAndBetPreserved: true,
            recoveryPinPreserved: true,
            encodedPayloadBytesBefore: storageBefore,
            encodedPayloadBytesAfter: (
              await db.prepare('SELECT sum(bytes) AS bytes FROM app_payload_objects').first<any>()
            ).bytes,
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
  'prefix planning preserves references from omitted clusters and formerly published drafts do not get seven-day expiry',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db)),
        pub = new PublicEditorial(s);
      await pub.publish(story('old-target', 91), 'PUBLISHED');
      const dependent = {
        ...story('old-dependent', 91),
        whatHappened: 'Required historical ID old-target',
      };
      await pub.publish(dependent, 'PUBLISHED');
      await pub.publish(story('formerly-published', 7), 'PUBLISHED');
      await pub.publish({ ...story('formerly-published', 7), version: 2 }, 'DRAFT');
      const planned = await planApprovedRetention(await frozenTables(db), now, 1);
      assert(!planned.items.some((c) => c.id === 'old-target'));
      assert(!planned.items.some((c) => c.id === 'formerly-published'));
      // Unknown opaque recovery graphs cannot be guessed away.
      await s.put({ cipher: 'opaque', iv: 'opaque', hiddenReference: 'old-target' });
      await assert.rejects(
        planApprovedRetention(await frozenTables(db), now),
        /Opaque encrypted recovery/,
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'prepared inbox and outbox share one immutable payload under concurrent delivery and preserve owner isolation',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        fresh = () => new Storage(db, new D1Objects(db)),
        s = fresh();
      for (const id of ['first-owner', 'second-owner'])
        await s
          .statement(
            "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES(?,?,'ACTIVE',1,1)",
            [id, id + '@example.invalid'],
          )
          .run();
      const { socialNotification, drainSocialNotifications } =
        await import('../../../packages/storage/social-outbox');
      const { D1Notifications } = await import('../../../packages/storage/notifications');
      await s.batch([
        await socialNotification(s, 'first-owner', 'original-event', {
          eventId: 'original-event',
          dedupeKey: 'original-event',
          title: 'Original inbox',
          body: 'Original owner',
          deepLink: '/profile',
        }),
      ]);
      await Promise.all([drainSocialNotifications(fresh()), drainSocialNotifications(fresh())]);
      const rows = await s.rows<any>(
        'SELECT n.object_hash,o.object_hash AS outbox_hash FROM app_notifications n JOIN app_social_notification_outbox o ON o.id=?',
        ['original-event'],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].object_hash, rows[0].outbox_hash);
      assert.equal(
        (await new D1Notifications(fresh()).exportNotifications('first-owner')).length,
        1,
      );
      assert.equal(
        (await new D1Notifications(fresh()).exportNotifications('second-owner')).length,
        0,
      );
      assert.equal((await drainSocialNotifications(fresh())).delivered, 0);
    } finally {
      await h.close();
    }
  },
);
