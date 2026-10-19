/** Local owner-only retention/archive executor. No remote mode or credentials.
 * Preparation verifies encrypted archive + complete synthetic target restore
 * before any logical row is eligible for removal. Production remains disabled. */
import retention from '../packages/storage/approved-retention.ts';
const {
  frozenTables,
  snapshotDigest,
  publishRetentionPlan,
  retentionStep,
  beginRetentionPreparation,
} = retention;
import { logicalExport } from './export-no-billing.mjs';
import { encryptBackup, decryptBackup } from './no-billing-backup.mjs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const [mode, directory, value, keyFile, limit = '100'] = process.argv.slice(2);
if (
  process.env.DD_APPROVED_RETENTION !== 'OWNER_LOCAL_WRITERS_STOPPED' ||
  !directory ||
  !['--prepare', '--step', '--status', '--abort-preparation'].includes(mode)
)
  throw Error(
    'Owner only: stop all writers, set DD_APPROVED_RETENTION=OWNER_LOCAL_WRITERS_STOPPED; --prepare LOCAL_DIR ARCHIVE KEY_FILE [LIMIT] | --step LOCAL_DIR RUN_ID | --status LOCAL_DIR | --abort-preparation LOCAL_DIR RUN_ID',
  );
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const open = (path) =>
  new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {}',
      resourcePersistencePath: resolve(path, 'v3'),
      d1Databases: { APP_DB: '00000000-0000-0000-0000-000000000000' },
      outboundService: () => new Response(null, { status: 403 }),
    }),
  );
const mf = open(directory),
  db = await mf.getD1Database('APP_DB');
try {
  if (mode === '--status') {
    console.log(
      JSON.stringify(
        (await db.prepare('SELECT * FROM app_storage_retention_plans ORDER BY created_at').all())
          .results,
        null,
        2,
      ),
    );
  } else if (mode === '--step') {
    const plan = await db
      .prepare('SELECT * FROM app_storage_retention_plans WHERE id=?')
      .bind(value)
      .first();
    if (!plan) throw Error('Unknown plan');
    if (hash(await readFile(plan.archive_path)) !== plan.archive_digest)
      throw Error('Verified offline archive missing or changed; no deletion allowed');
    console.log(JSON.stringify(await retentionStep(db, value, 'OWNER_PRIVATE_MAINTENANCE')));
  } else if (mode === '--abort-preparation') {
    const token = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO app_storage_guards(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM app_storage_retention_plans p JOIN app_storage_epoch e ON e.epoch=p.epoch WHERE p.id=? AND p.state='PREPARING' AND e.locked=1) THEN 1 ELSE 0 END)",
        )
        .bind(token, value),
      db.prepare('DELETE FROM app_storage_retention_items WHERE run_id=?').bind(value),
      db
        .prepare("DELETE FROM app_storage_retention_plans WHERE id=? AND state='PREPARING'")
        .bind(value),
      db.prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1'),
      db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token),
    ]);
    console.log(JSON.stringify({ abortedBeforeAnyDeletion: true }));
  } else {
    if (
      !value ||
      !keyFile ||
      !Number.isInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 500
    )
      throw Error('Archive, separate 32-byte key and limit 1–500 required');
    const key = await readFile(keyFile);
    if (key.length !== 32) throw Error('Separate 32-byte offline archive key required');
    const preparationId = await beginRetentionPreparation(db, resolve(value));
    const epoch = (await db.prepare('SELECT epoch FROM app_storage_epoch WHERE id=1').first())
      .epoch;
    let targetDir;
    try {
      const tables = await frozenTables(db),
        snapshot = await snapshotDigest(tables);
      const original = await logicalExport(async (sql) => (await db.prepare(sql).all()).results);
      const encrypted = encryptBackup(original, key),
        path = resolve(value);
      await writeFile(path, encrypted, { flag: 'wx', mode: 0o600 });
      const disk = await readFile(path),
        decoded = decryptBackup(disk, key);
      if (!decoded.equals(original)) throw Error('Archive integrity verification failed');
      targetDir = await mkdtemp('/private/tmp/dd-retention-restore-');
      const sqlFile = resolve(targetDir, 'restore.sql');
      await writeFile(sqlFile, decoded, { mode: 0o600 });
      const env = Object.fromEntries(
        ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
          .filter((k) => process.env[k])
          .map((k) => [k, process.env[k]]),
      );
      Object.assign(env, {
        CI: 'true',
        WRANGLER_SEND_METRICS: 'false',
        CLOUDFLARE_API_TOKEN: '',
        CLOUDFLARE_ACCOUNT_ID: '',
      });
      const restore = spawnSync(
        process.execPath,
        [
          'node_modules/wrangler/bin/wrangler.js',
          'd1',
          'execute',
          'APP_DB',
          '--local',
          '--config',
          'wrangler.api-no-billing-local.toml',
          '--persist-to',
          targetDir,
          '--file',
          sqlFile,
        ],
        { env, encoding: 'utf8', maxBuffer: 8_000_000 },
      );
      if (restore.status !== 0)
        throw Error('Archive restore verification failed: ' + restore.stderr);
      const target = open(targetDir);
      try {
        const restored = await target.getD1Database('APP_DB');
        if ((await restored.prepare('PRAGMA foreign_key_check').all()).results.length)
          throw Error('Restored archive has foreign key errors');
        if ((await snapshotDigest(await frozenTables(restored))) !== snapshot)
          throw Error('Archive incomplete: frozen tables/FTS rowids differ after restore');
      } finally {
        await target.dispose();
      }
      const result = await publishRetentionPlan(
        db,
        tables,
        { digest: hash(disk), path, snapshotDigest: snapshot },
        Date.now(),
        Number(limit),
        preparationId,
      );
      console.log(
        JSON.stringify({
          ...result,
          archiveVerified: true,
          fullRestoreVerified: true,
          archivePath: path,
        }),
      );
    } catch (error) {
      const plans = await db
        .prepare("SELECT id FROM app_storage_retention_plans WHERE epoch=? AND state<>'DONE'")
        .bind(epoch)
        .all();
      if (plans.results.length === 0)
        await db
          .prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1 AND epoch=?')
          .bind(epoch)
          .run();
      throw error;
    } finally {
      if (targetDir) await rm(targetDir, { recursive: true, force: true });
    }
  }
} finally {
  await mf.dispose();
}
