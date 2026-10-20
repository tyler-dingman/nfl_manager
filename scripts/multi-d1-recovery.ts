import { openErasureLedger, replayErasureLedger } from './erasure-ledger';
/** Offline owner maintenance only. Never imported by a public Worker route. */
import { DATABASE_OWNERS, MAPPING_VERSION, type DatabaseOwner } from '../packages/storage/multi-d1';
import type { SqlDatabase } from '../packages/storage/core';
import {
  sealMultiD1Archive,
  openMultiD1Archive,
  type MultiD1Archive,
  type ShardExport,
} from '../packages/storage/multi-d1-recovery';

export type Databases = Record<DatabaseOwner, SqlDatabase>;
export async function backupDatabases(
  databases: Databases,
  secret: string,
  options: {
    rawWritersStopped: boolean;
    verifyReferences: (databases: Databases) => Promise<void>;
    afterVerifiedArchive?: (
      archive: MultiD1Archive,
      epochs: Map<DatabaseOwner, number>,
    ) => Promise<void>;
  },
) {
  if (!options.rawWritersStopped)
    throw Error('Stop every raw/import/scheduler writer before maintenance');
  const { logicalExport } = await import('./export-no-billing.mjs');
  const locked = new Map<DatabaseOwner, number>(),
    windowId = crypto.randomUUID();
  let maintenanceStarted = false,
    maintenanceSucceeded = false;
  try {
    // Acquire ALL fences before reading ANY snapshot. Epoch increments invalidate in-flight SDK writers.
    for (const owner of DATABASE_OWNERS) {
      const db = databases[owner];
      if (!db) throw Error(`Missing shard ${owner}`);
      await db
        .prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)')
        .run();
      const row = await db
        .prepare(
          'UPDATE app_storage_epoch SET epoch=epoch+1,locked=1 WHERE id=1 AND locked=0 RETURNING epoch',
        )
        .first<{ epoch: number }>();
      if (!row) throw Error(`Maintenance already active: ${owner}`);
      locked.set(owner, row.epoch);
    }
    await options.verifyReferences(databases);
    const exports: ShardExport[] = [];
    for (const owner of DATABASE_OWNERS) {
      const db = databases[owner];
      const sql = await logicalExport(async (sql: string) => (await db.prepare(sql).all()).results);
      exports.push({
        owner,
        mappingVersion: MAPPING_VERSION,
        windowId,
        epoch: locked.get(owner)!,
        snapshot: { format: 'sqlite-logical-v1', sql: sql.toString('utf8') },
      });
    }
    // Raw SQL outside this owner process must remain stopped; fencing alone cannot stop raw access.
    for (const [owner, epoch] of locked) {
      const row = await databases[owner]
        .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
        .first<{ epoch: number; locked: number }>();
      if (row?.epoch !== epoch || row.locked !== 1) throw Error('Maintenance fence changed');
    }
    const archive = await sealMultiD1Archive(exports, secret, windowId);
    await openMultiD1Archive(archive, secret);
    if (options.afterVerifiedArchive) {
      maintenanceStarted = true;
      await options.afterVerifiedArchive(archive, locked);
      maintenanceSucceeded = true;
    }
    return archive;
  } finally {
    if (!maintenanceStarted || maintenanceSucceeded)
      for (const [owner, epoch] of locked)
        await databases[owner]
          .prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1 AND epoch=? AND locked=1')
          .bind(epoch)
          .run();
  }
}
/** Restore only into ten EMPTY isolated destinations. If interrupted, leave destinations
 * locked and isolated; discard synthetic targets/restart into NEW empty databases.
 * No existing user table is deleted and a partial restore is never advertised as ready. */
export async function restoreDatabases(
  archive: MultiD1Archive,
  secret: string,
  destinations: Databases,
  options: {
    currentErasureLedger: unknown;
    isolatedEmptyTargets: boolean;
    execute: (owner: DatabaseOwner, sql: string) => Promise<void>;
    verifyReferences: (databases: Databases) => Promise<void>;
  },
) {
  if (!options.isolatedEmptyTargets) throw Error('Isolated empty restore targets required');
  // Authenticate every shard before issuing ANY destination mutation.
  const entries = await openErasureLedger(options.currentErasureLedger, secret);
  const decoded = await openMultiD1Archive(archive, secret);
  for (const owner of DATABASE_OWNERS) {
    if (!destinations[owner]) throw Error(`Missing destination: ${owner}`);
    const tables = await destinations[owner]
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
      )
      .all();
    if (tables.results.length) throw Error('Restore destination must be empty');
  }
  // Restore referenced content/metadata before private references; no HTTP traffic is permitted.
  const order = [...DATABASE_OWNERS.filter((o) => o !== 'D1_USERS'), 'D1_USERS'] as DatabaseOwner[];
  for (const owner of order) {
    const value = decoded.exports.find((e) => e.owner === owner)!,
      snapshot = value.snapshot as any;
    if (snapshot?.format !== 'sqlite-logical-v1' || typeof snapshot.sql !== 'string')
      throw Error('Unsupported lossless snapshot format');
    await options.execute(owner, snapshot.sql);
    const db = destinations[owner];
    const fk = await db.prepare('PRAGMA foreign_key_check').all();
    if (fk.results.length) throw Error('Restore foreign key mismatch');
    const integrity = await db.prepare('PRAGMA quick_check').all<{ quick_check: string }>();
    if (integrity.results.some((r) => r.quick_check !== 'ok'))
      throw Error('Restore integrity failed');
  }
  await replayErasureLedger(destinations.D1_USERS, entries);
  await options.verifyReferences(destinations);
  // Unlock only after every schema, payload and cross-database reference has been verified.
  for (const owner of DATABASE_OWNERS)
    await destinations[owner]
      .prepare('UPDATE app_storage_epoch SET epoch=epoch+1,locked=0 WHERE id=1 AND locked=1')
      .run();
  return {
    databases: 10,
    mappingVersion: MAPPING_VERSION,
    windowId: decoded.manifest.windowId,
    consistentMaintenanceWindow: true,
    atomicSnapshot: false,
  };
}
