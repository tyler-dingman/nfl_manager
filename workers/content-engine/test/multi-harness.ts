import { splitSql } from '../../../packages/storage/sql-script';
export { splitSql } from '../../../packages/storage/sql-script';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { DATABASE_OWNERS, type DatabaseOwner } from '../../../packages/storage/multi-d1';
import type { SqlDatabase } from '../../../packages/storage/core';
export async function multiHarness(
  initialize = true,
  script = 'export default {fetch(){return new Response("isolated")}}',
  ownerToolPaths = false,
) {
  const directory = await mkdtemp('/private/tmp/dd-rc-ten-');
  const options = {
    name: 'rc-local',
    modules: true,
    script,
    compatibilityDate: '2026-10-18',
    compatibilityFlags: ['nodejs_compat'],
    bindings: { CONTENT_ENV: 'local', LOCAL_INGEST_TOKEN: 'synthetic-loopback-token-only' },
    resourcePersistencePath: ownerToolPaths ? directory + '/v3' : directory,
    d1Databases: Object.fromEntries(
      DATABASE_OWNERS.map((o, i) => [
        o,
        ownerToolPaths
          ? `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`
          : `synthetic-rc-${i}`,
      ]),
    ),
    outboundService: () => new Response('External network disabled', { status: 403 }),
    telemetry: { enabled: false },
  };
  let mf = new Miniflare(convertV4MiniflareOptions(options));
  const load = async () =>
    Object.fromEntries(
      await Promise.all(
        DATABASE_OWNERS.map(async (owner) => [owner, await mf.getD1Database(owner)]),
      ),
    ) as Record<DatabaseOwner, SqlDatabase>;
  let db = await load(),
    suspended = false;
  try {
    if (initialize)
      for (const owner of DATABASE_OWNERS) {
        const role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team';
        const base = new URL(`../../multi-d1/migrations/${role}/`, import.meta.url);
        for (const file of (await readdir(base)).filter((f) => f.endsWith('.sql')).sort())
          for (const sql of splitSql(await readFile(new URL(file, base), 'utf8')))
            await db[owner].prepare(sql).run();
      }
  } catch (error) {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    get db() {
      return db;
    },
    get mf() {
      return mf;
    },
    async suspend() {
      if (!suspended) await mf.dispose();
      suspended = true;
    },
    async restart() {
      if (!suspended) await mf.dispose();
      suspended = false;
      mf = new Miniflare(convertV4MiniflareOptions(options));
      db = await load();
    },
    async close() {
      if (!suspended) await mf.dispose();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
