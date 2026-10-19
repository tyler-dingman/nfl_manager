/** Explicit LOCAL owner tool. No remote mode, credential discovery, email or provider calls. */
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DATABASE_OWNERS } from '../packages/storage/multi-d1';
import { backupDatabases, restoreDatabases, type Databases } from './multi-d1-recovery';
import { maintainMultiD1 } from './maintain-multi-d1';
import { verifyCrossShardReferences } from '../packages/storage/cross-shard-saves';
import { splitSql } from '../packages/storage/sql-script';
async function main() {
  const [mode, local, persist, file, ack] = process.argv.slice(2),
    key = process.env.DD_OFFLINE_BACKUP_KEY ?? '';
  if (
    !['backup', 'restore', 'maintain'].includes(mode) ||
    local !== '--local' ||
    !persist ||
    !file ||
    ack !== 'WRITERS_STOPPED' ||
    key.length < 32
  )
    throw Error(
      'Usage: backup|restore|maintain --local PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED; set DD_OFFLINE_BACKUP_KEY (32+ characters).',
    );
  if (process.env.DATABASE_URL) throw Error('DATABASE_URL must be absent');
  const text = await readFile('wrangler.api-multi-d1-local.toml', 'utf8'),
    bindings: Record<string, string> = {};
  for (const block of text.split('[[d1_databases]]').slice(1)) {
    const name = block.match(/binding\s*=\s*"([^"]+)"/)?.[1],
      id = block.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
    if (name && id) bindings[name] = id;
  }
  if (DATABASE_OWNERS.some((o) => !bindings[o]) || new Set(Object.values(bindings)).size !== 10)
    throw Error('Expected ten distinct local configured databases');
  await mkdir(persist, { recursive: true });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'owner-local-only',
      modules: true,
      script: 'export default {fetch(){return new Response(null,{status:404})}}',
      compatibilityDate: '2026-10-18',
      d1Databases: bindings,
      resourcePersistencePath: resolve(persist, 'v3'),
      telemetry: { enabled: false },
      outboundService: () => new Response('External network disabled', { status: 403 }),
    }),
  );
  try {
    const databases = Object.fromEntries(
      await Promise.all(DATABASE_OWNERS.map(async (o) => [o, await mf.getD1Database(o)])),
    ) as Databases;
    const persistAndReadBack = async (archive: any) => {
      await writeFile(file, JSON.stringify(archive), { flag: 'wx', mode: 0o600 });
      return { path: resolve(file), archive: JSON.parse(await readFile(file, 'utf8')) };
    };
    if (mode === 'backup') {
      const archive = await backupDatabases(databases, key, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      await persistAndReadBack(archive);
      console.log(
        JSON.stringify({ status: 'encrypted-backup-written', databases: 10, path: resolve(file) }),
      );
    }
    if (mode === 'maintain') {
      const result = await maintainMultiD1(databases, key, {
        rawWritersStopped: true,
        now: Date.now(),
        persistAndReadBack,
      });
      console.log(
        JSON.stringify({
          status: 'maintenance-complete',
          databases: result.length,
          path: resolve(file),
        }),
      );
    }
    if (mode === 'restore') {
      const archive = JSON.parse(await readFile(file, 'utf8'));
      const result = await restoreDatabases(archive, key, databases, {
        isolatedEmptyTargets: true,
        execute: async (owner, sql) => {
          for (const statement of splitSql(sql)) await databases[owner].prepare(statement).run();
        },
        verifyReferences: verifyCrossShardReferences,
      });
      console.log(JSON.stringify(result));
    }
  } finally {
    await mf.dispose();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Owner operation failed');
  process.exitCode = 1;
});
