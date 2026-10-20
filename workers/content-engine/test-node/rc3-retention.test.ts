import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import { backupDatabases } from '../../../scripts/multi-d1-recovery';
import { verifyCrossShardReferences } from '../../../packages/storage/cross-shard-saves';
import {
  frozenTables,
  publishRetentionPlan,
  snapshotDigest,
  retentionStep,
} from '../../../packages/storage/approved-retention';
import { collectPayloadGarbage } from '../../../packages/storage/garbage-collection';

test(
  'completed odds payload compaction resumes atomically and preserves active/uncertain work and replay IDs',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness();
    try {
      const db = h.db.D1_SHARED,
        s = new MultiD1(h.db).shared(),
        now = Date.now(),
        old = now - 40 * 86400000;
      const hash = await s.put({ rawProviderEvidence: 'old provider payload'.repeat(100) });
      for (const [slot, state, status] of [
        ['old', 'COMPLETE', 'DONE'],
        ['uncertain', 'UNCERTAIN', 'DONE'],
        ['pending', 'COMPLETE', 'READY'],
      ] as const) {
        await db
          .prepare(
            'INSERT INTO app_odds_fetch_runs(slot,state,token,starts_at,ends_at) VALUES(?,?,?,1,2)',
          )
          .bind(slot, state, slot)
          .run();
        await db
          .prepare(
            'INSERT INTO app_odds_processing(slot,event_id,object_hash,reference_json,as_of,status) VALUES(?,?,?,?,?,?)',
          )
          .bind(
            slot,
            slot + '-event',
            hash,
            JSON.stringify({ id: slot + '-event', hash }),
            old,
            status,
          )
          .run();
      }
      // Use distinct bodies for incomplete work so the eligible root is independently collectable.
      const retained = await s.put({ rawProviderEvidence: 'active immutable body' });
      await db
        .prepare("UPDATE app_odds_processing SET object_hash=?,reference_json=? WHERE slot<>'old'")
        .bind(retained, JSON.stringify({ id: 'active', hash: retained }))
        .run();
      await backupDatabases(h.db, 'synthetic-retention-archive-key-at-least-32', {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
        afterVerifiedArchive: async () => {
          const tables = await frozenTables(db, 'shared');
          const plan = await publishRetentionPlan(
            db,
            tables,
            {
              path: '/verified/synthetic',
              digest: 'a'.repeat(64),
              snapshotDigest: await snapshotDigest(tables),
            },
            now,
            100,
            undefined,
            'shared',
          );
          assert.equal(plan.planned, 1);
          let maxStepQueries = 0;
          const step = async () => {
            const metrics = requestMetrics();
            try {
              return await retentionStep(
                instrumentDatabase(db, metrics, 49),
                plan.runId,
                'OWNER_PRIVATE_MAINTENANCE',
                true,
              );
            } finally {
              maxStepQueries = Math.max(maxStepQueries, metrics.statements);
            }
          };
          await db
            .prepare(
              "CREATE TRIGGER rc3_interrupt BEFORE UPDATE ON app_odds_processing BEGIN SELECT RAISE(ABORT,'interrupted compaction'); END",
            )
            .run();
          await assert.rejects(step(), /interrupted compaction/);
          assert.equal(
            (
              await db
                .prepare("SELECT object_hash FROM app_odds_processing WHERE slot='old'")
                .first<any>()
            )?.object_hash,
            hash,
          );
          assert.equal(
            (
              await db
                .prepare('SELECT last_ordinal FROM app_storage_retention_plans WHERE id=?')
                .bind(plan.runId)
                .first<any>()
            )?.last_ordinal,
            0,
          );
          await db.prepare('DROP TRIGGER rc3_interrupt').run();
          await step();
          assert.equal((await step()).done, true);
          const oldRow = await db
            .prepare("SELECT * FROM app_odds_processing WHERE slot='old'")
            .first<any>();
          assert.equal(oldRow.status, 'DONE');
          assert.equal(oldRow.event_id, 'old-event');
          assert.notEqual(oldRow.object_hash, hash);
          const epoch = await db
            .prepare('SELECT epoch FROM app_storage_epoch WHERE id=1')
            .first<any>();
          const gc = await collectPayloadGarbage(db, {
            dryRun: false,
            limit: 500,
            role: 'shared',
            acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
            coordinatedEpoch: epoch.epoch,
          });
          console.log(
            'RC3_RETENTION',
            JSON.stringify({ maxStepQueries, interruptedRollback: true }),
          );
          assert.ok(gc.deletedObjects > 0);
          assert.equal(
            await db
              .prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
              .bind(hash)
              .first(),
            null,
          );
          assert.ok(
            await db
              .prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
              .bind(retained)
              .first(),
          );
        },
      });
    } finally {
      await h.close();
    }
  },
);

test(
  'completed handoff bodies retire only with verified destination receipts; interrupted audit rolls back',
  { timeout: 120000 },
  async () => {
    const { reconcileMultiD1References } =
      await import('../../../packages/storage/reconcile-multi-d1');
    const { DATABASE_OWNERS } = await import('../../../packages/storage/multi-d1');
    const h = await multiHarness();
    try {
      const source = h.db.D1_TEAM_1,
        target = h.db.D1_TEAM_2;
      await source
        .prepare(
          "INSERT INTO app_editorial_sources(id,name,league_wide,source_type,polling_tier,priority,enabled,object_hash,next_check_at,updated_at) VALUES('original-source','Original Publisher',0,'RSS','A',1,0,?,0,1)",
        )
        .bind('a'.repeat(64))
        .run();
      for (const [id, status] of [
        ['verified', 'DONE'],
        ['unresolved', 'DONE'],
        ['inflight', 'READY'],
      ])
        await source
          .prepare(
            'INSERT INTO app_editorial_handoffs(id,source_id,external_id,canonical_url,target,object_hash,status) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            'original-source',
            id,
            'https://example.invalid/' + id,
            'D1_TEAM_2',
            'b'.repeat(64),
            status,
          )
          .run();
      await target
        .prepare(
          "INSERT INTO app_storage_candidate_receipts(id,source_id,external_id,canonical_url,fingerprint) VALUES('destination','original-source','verified','https://example.invalid/verified','fingerprint')",
        )
        .run();
      for (const owner of DATABASE_OWNERS)
        await h.db[owner]
          .prepare(
            'INSERT INTO app_storage_epoch(id,epoch,locked) VALUES(1,1,1) ON CONFLICT(id) DO UPDATE SET locked=1',
          )
          .run();
      await source
        .prepare(
          "CREATE TRIGGER rc3_audit_failure BEFORE INSERT ON app_storage_retention_audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
        )
        .run();
      await assert.rejects(
        reconcileMultiD1References(h.db, Date.now(), 'c'.repeat(64)),
        /audit unavailable/,
      );
      assert.equal(
        (
          await source
            .prepare("SELECT object_hash FROM app_editorial_handoffs WHERE id='verified'")
            .first<any>()
        )?.object_hash,
        'b'.repeat(64),
      );
      await source.prepare('DROP TRIGGER rc3_audit_failure').run();
      const result = await reconcileMultiD1References(h.db, Date.now(), 'c'.repeat(64));
      assert.equal(result.retiredHandoffPayloads, 1);
      const rows = (
        await source.prepare('SELECT * FROM app_editorial_handoffs ORDER BY id').all<any>()
      ).results;
      for (const row of rows) {
        assert.equal(row.source_id, 'original-source');
        assert.equal(row.external_id, row.id);
        assert.equal(row.object_hash, row.id === 'verified' ? null : 'b'.repeat(64));
      }
      assert.equal(
        (await reconcileMultiD1References(h.db, Date.now(), 'c'.repeat(64))).retiredHandoffPayloads,
        0,
      );
    } finally {
      await h.close();
    }
  },
);
