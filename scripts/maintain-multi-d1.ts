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
  const results: any[] = [];
  await backupDatabases(databases, secret, {
    rawWritersStopped: options.rawWritersStopped,
    verifyReferences: verifyCrossShardReferences,
    afterVerifiedArchive: async (archive, epochs) => {
      const stored = await options.persistAndReadBack(archive);
      if (!stored.path) throw Error('Persistent owner archive path required');
      const recovered = await openMultiD1Archive(stored.archive, secret),
        original = await openMultiD1Archive(archive, secret);
      if (JSON.stringify(recovered) !== JSON.stringify(original))
        throw Error('Owner archive read-back mismatch');
      const archiveDigest = await digest(utf8.encode(JSON.stringify(stored.archive)));
      // Every database remains locked while any shard is retired or swept. A failure leaves all locked.
      await verifyCrossShardReferences(databases);
      const reconciliation = await reconcileMultiD1References(databases, options.now);
      for (const owner of DATABASE_OWNERS) {
        const db = databases[owner],
          role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team';
        const tables = await frozenTables(db, role),
          receipt = {
            path: stored.path,
            digest: archiveDigest,
            snapshotDigest: await snapshotDigest(tables),
          };
        const plan = await publishRetentionPlan(
          db,
          tables,
          receipt,
          options.now,
          100,
          undefined,
          role,
        );
        for (let step = 0; step <= 100; step++) {
          const result = await retentionStep(db, plan.runId, 'OWNER_PRIVATE_MAINTENANCE', true);
          if (result.done) break;
          if (step === 100) throw Error('Unexpected retention continuation bound');
        }
        const gc = await collectPayloadGarbage(db, {
          dryRun: false,
          limit: 500,
          acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
          role,
          coordinatedEpoch: epochs.get(owner),
        });
        results.push({
          owner,
          retention: plan,
          gc,
          ...(owner === 'D1_USERS' ? { reconciliation } : {}),
        });
      }
      await verifyCrossShardReferences(databases);
    },
  });
  return results;
}
