import { reconcileMultiD1References } from '../packages/storage/reconcile-multi-d1';
/** Owner-only, coordinated maintenance. Persist/read-back an encrypted archive before deletion. */
import { backupDatabases, type Databases } from './multi-d1-recovery';
import { DATABASE_OWNERS } from '../packages/storage/multi-d1';
import { verifyCrossShardReferences } from '../packages/storage/cross-shard-saves';
import {
  frozenTables,
  publishRetentionPlan,
  retentionStep,
  snapshotDigest,
} from '../packages/storage/approved-retention';
import { collectPayloadGarbage } from '../packages/storage/garbage-collection';
import { openMultiD1Archive, type MultiD1Archive } from '../packages/storage/multi-d1-recovery';
import { digest, utf8 } from '../packages/storage/core';
async function runLockedMaintenance(
  databases: Databases,
  secret: string,
  stored: { path: string; archive: MultiD1Archive },
  now: number,
) {
  if (!stored.path) throw Error('Persistent owner archive path required');
  const decoded = await openMultiD1Archive(stored.archive, secret);
  const epochs = new Map(decoded.manifest.databases.map((d) => [d.owner, d.epoch]));
  for (const owner of DATABASE_OWNERS) {
    const epoch = await databases[owner]
      .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
      .first<any>();
    if (epoch?.locked !== 1 || epoch.epoch !== epochs.get(owner))
      throw Error('Original coordinated maintenance epochs required');
  }
  const results: any[] = [];
  const archiveDigest = await digest(utf8.encode(JSON.stringify(stored.archive)));
  // Every database remains locked while any shard is retired or swept. A failure leaves all locked.
  await verifyCrossShardReferences(databases);
  const reconciliation = await reconcileMultiD1References(databases, now, archiveDigest);
  for (const owner of DATABASE_OWNERS) {
    const db = databases[owner],
      role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team';
    const pending = await db
      .prepare(
        "SELECT id,state,archive_digest FROM app_storage_retention_plans WHERE state<>'DONE'",
      )
      .all<any>();
    for (const p of pending.results) {
      if (p.archive_digest !== archiveDigest)
        throw Error('Resume requires the original verified maintenance archive');
      if (p.state === 'PREPARING') {
        await db.batch([
          db.prepare('DELETE FROM app_storage_retention_items WHERE run_id=?').bind(p.id),
          db
            .prepare("DELETE FROM app_storage_retention_plans WHERE id=? AND state='PREPARING'")
            .bind(p.id),
        ]);
      } else {
        while (!(await retentionStep(db, p.id, 'OWNER_PRIVATE_MAINTENANCE', true)).done) {}
      }
    }
    const plans = [];
    for (;;) {
      const tables = await frozenTables(db, role);
      const plan = await publishRetentionPlan(
        db,
        tables,
        {
          path: stored.path,
          digest: archiveDigest,
          snapshotDigest: await snapshotDigest(tables),
        },
        now,
        100,
        undefined,
        role,
      );
      plans.push(plan);
      while (!(await retentionStep(db, plan.runId, 'OWNER_PRIVATE_MAINTENANCE', true)).done) {}
      if (plan.planned < 100) break;
    }
    const plan = plans[0];
    let gc = await collectPayloadGarbage(db, {
      dryRun: false,
      limit: 500,
      acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
      role,
      coordinatedEpoch: epochs.get(owner),
    });
    const gcSteps = [gc];
    while (gc.deletedObjects > 0 && gc.candidateObjects > gc.deletedObjects) {
      gc = await collectPayloadGarbage(db, {
        dryRun: false,
        limit: 500,
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
        role,
        coordinatedEpoch: epochs.get(owner),
      });
      gcSteps.push(gc);
    }
    results.push({
      owner,
      retention: plan,
      retentionPlans: plans,
      gc,
      gcSteps,
      ...(owner === 'D1_USERS' ? { reconciliation } : {}),
    });
  }
  await verifyCrossShardReferences(databases);
  const remainingMail = await databases.D1_USERS.prepare(
    'SELECT 1 FROM app_storage_erased_mail e JOIN app_payload_objects p ON p.hash=e.hash LIMIT 1',
  ).first();
  if (remainingMail)
    throw Error('Erased mail is still retained; inspect pins before completing erasure');
  await databases.D1_USERS.prepare(
    "UPDATE app_account_erasure SET status='COMPLETE',updated_at=? WHERE status='AWAITING_GC'",
  )
    .bind(now)
    .run();
  return results;
}
export async function maintainMultiD1(
  databases: Databases,
  secret: string,
  options: {
    rawWritersStopped: boolean;
    now: number;
    persistAndReadBack: (
      archive: MultiD1Archive,
    ) => Promise<{ path: string; archive: MultiD1Archive }>;
  },
) {
  let results: any[] = [];
  await backupDatabases(databases, secret, {
    rawWritersStopped: options.rawWritersStopped,
    verifyReferences: verifyCrossShardReferences,
    afterVerifiedArchive: async (archive) => {
      const stored = await options.persistAndReadBack(archive);
      const original = await openMultiD1Archive(archive, secret),
        readBack = await openMultiD1Archive(stored.archive, secret);
      if (JSON.stringify(original) !== JSON.stringify(readBack))
        throw Error('Owner archive read-back mismatch');
      results = await runLockedMaintenance(databases, secret, stored, options.now);
    },
  });
  return results;
}
/** Resume only with the authenticated original archive and every matching fence
 * still held. No new archive can replace the pre-deletion recovery evidence. */
export async function resumeMultiD1Maintenance(
  databases: Databases,
  secret: string,
  stored: { path: string; archive: MultiD1Archive },
  options: { rawWritersStopped: boolean; now: number },
) {
  if (!options.rawWritersStopped) throw Error('Stop every writer before resuming maintenance');
  const results = await runLockedMaintenance(databases, secret, stored, options.now);
  for (const owner of DATABASE_OWNERS)
    await databases[owner]
      .prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1 AND locked=1')
      .run();
  return results;
}
