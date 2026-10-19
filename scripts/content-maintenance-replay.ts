/** Owner-local maintenance/recovery measurement on a frozen synthetic day DB. */
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { randomBytes, createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { instrumentDatabase, requestMetrics } from '../packages/storage/instrumentation';
import {
  frozenTables,
  snapshotDigest,
  beginRetentionPreparation,
  publishRetentionPlan,
  retentionStep,
} from '../packages/storage/approved-retention';
import { collectPayloadGarbage } from '../packages/storage/garbage-collection';
const currentRetention = {
  frozenTables,
  snapshotDigest,
  beginRetentionPreparation,
  publishRetentionPlan,
  retentionStep,
};
// SQL literal aware, including doubled quotes. Used only on our own exporter.
function statements(sql: string) {
  let quote = '',
    start = 0;
  const result: string[] = [];
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      if (c === quote) {
        if (sql[i + 1] === quote) i++;
        else quote = '';
      }
    } else if (c === "'" || c === '"') quote = c;
    else if (c === ';') {
      const part = sql.slice(start, i).trim();
      if (part) result.push(part);
      start = i + 1;
    }
  }
  if (quote || sql.slice(start).trim()) throw Error('Incomplete exported SQL');
  return result;
}
export async function replayMaintenance(
  raw: any,
  now: number,
  directory: string,
  baselineFiles?: { retention: string; export: string },
) {
  const loaded = baselineFiles ? await import(pathToFileURL(baselineFiles.retention).href) : null;
  const {
    frozenTables,
    snapshotDigest,
    beginRetentionPreparation,
    publishRetentionPlan,
    retentionStep,
  } = loaded ? (loaded.default ?? loaded) : currentRetention;
  const { logicalExport } = await import(
    pathToFileURL(baselineFiles?.export ?? resolve('scripts/export-no-billing.mjs')).href
  );
  const { encryptBackup, decryptBackup } = await import(
    pathToFileURL(resolve('scripts/no-billing-backup.mjs')).href
  );
  const preparation = requestMetrics(),
    db = instrumentDatabase(raw, preparation),
    path = directory + '/verified-synthetic-day.aes';
  const intent = await beginRetentionPreparation(db, path),
    tables = await frozenTables(db),
    snapshot = await snapshotDigest(tables);
  const exported = await logicalExport(
      async (sql: string) => (await db.prepare(sql).all()).results,
    ),
    key = randomBytes(32),
    encrypted = encryptBackup(exported, key);
  await writeFile(path, encrypted, { flag: 'wx', mode: 0o600 });
  const disk = await readFile(path),
    plain = decryptBackup(disk, key);
  if (!plain.equals(exported)) throw Error('Archive read-back mismatch');
  const target = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {}',
      d1Databases: { RESTORE: 'synthetic-content-day-restore' },
      telemetry: { enabled: false },
    }),
  );
  const recovery = requestMetrics();
  let restoreVerified = false;
  try {
    const restored = instrumentDatabase((await target.getD1Database('RESTORE')) as any, recovery),
      parts = statements(plain.toString());
    for (let i = 0; i < parts.length; i += 48)
      await restored.batch(parts.slice(i, i + 48).map((sql) => restored.prepare(sql)));
    if ((await restored.prepare('PRAGMA foreign_key_check').all()).results.length)
      throw Error('Restore FK mismatch');
    if ((await snapshotDigest(await frozenTables(restored))) !== snapshot)
      throw Error('Restore inventory/FTS rowids mismatch');
    restoreVerified = true;
  } finally {
    await target.dispose();
  }
  const planned = await publishRetentionPlan(
    db,
    tables,
    { digest: createHash('sha256').update(disk).digest('hex'), path, snapshotDigest: snapshot },
    now,
    500,
    intent,
  );
  const steps: any[] = [];
  for (let i = 0; i < 501; i++) {
    if (
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex') !== createHash('sha256').update(disk).digest('hex')
    )
      throw Error('Verified archive changed before retention step');
    const metrics = requestMetrics(),
      step = await retentionStep(
        instrumentDatabase(raw, metrics),
        planned.runId,
        'OWNER_PRIVATE_MAINTENANCE',
      );
    steps.push({ ...metrics, ...step });
    if (step.done) break;
  }
  if (!steps.at(-1)?.done) throw Error('Retention did not finish');
  const gc = await collectPayloadGarbage(raw, {
    acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
    dryRun: false,
    limit: 500,
    expireDerived: true,
  });
  return {
    scope:
      'Owner-only offline preparation/restore, not one Worker invocation; retention steps individually bounded. All archived tables and FTS rowids compared before deletion.',
    restoreVerified,
    archiveBytes: encrypted.length,
    archiveTwoCopiesBytes: encrypted.length * 2,
    preparation,
    recovery,
    steps,
    gc,
    selected: planned.planned,
    retired: steps.reduce((n, x) => n + x.retired, 0),
    onlineCleanupRowsWritten: steps.reduce((n, x) => n + x.rowsWritten, 0) + gc.rowsWritten,
    onlineCleanupRowsRead: steps.reduce((n, x) => n + x.rowsRead, 0) + gc.rowsRead,
  };
}
