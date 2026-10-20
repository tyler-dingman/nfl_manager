import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { DATABASE_OWNERS, type DatabaseOwner } from '../../packages/storage/multi-d1';
import type { SqlDatabase } from '../../packages/storage/core';
import { splitSql } from '../../packages/storage/sql-script';
import { createWorkerBindings } from '../../src/server/node-staging/d1-worker';
import { TRANSACTION_AUDIENCE } from '../../packages/security/transaction-boundary';
export const publicOrigin = 'https://down-distance-rc3-staging-web.tdingman5.workers.dev';
export const transactionSecret =
  'synthetic-native-boundary-secret-independent-64-characters-for-local-tests';
export const configuration = {
  publicOrigin,
  audience: TRANSACTION_AUDIENCE,
  secret: transactionSecret,
};
export async function nativeFixture(initialize = true) {
  const directory = await mkdtemp('/private/tmp/dd-boundary-');
  const env = {
    DD_TRANSACTION_BOUNDARY: 'true',
    DD_TRANSACTION_SECRET: transactionSecret,
    STAGING_ACCESS_HOST: new URL(publicOrigin).hostname,
    STAGING_ACCESS_SECRET: 'synthetic-boundary-browser-gate-secret-independent-64-characters-only',
    STAGING_ACCESS_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
  };
  const common = {
    modules: true,
    compatibilityDate: '2026-10-18',
    compatibilityFlags: ['nodejs_compat'],
    bindings: env,
    outboundService: () => new Response('External sockets disabled', { status: 503 }),
  };
  const databases = Object.fromEntries(DATABASE_OWNERS.map((o) => [o, 'native-boundary-' + o]));
  const options = convertV4MiniflareOptions({
    ...(process.env.DD_GATEWAY_PROFILE_OUT ? { inspectorPort: 0 } : {}),
    resourcePersistencePath: directory,
    telemetry: { enabled: false },
    workers: [
      {
        ...common,
        name: 'boundary-web',
        scriptPath: process.cwd() + '/.staging/transaction-boundary/web.mjs',
        d1Databases: { D1_USERS: databases.D1_USERS },
        serviceBindings: { API_SERVICE: 'boundary-api' },
      },
      {
        ...common,
        name: 'boundary-api',
        ...(process.env.DD_GATEWAY_PROFILE_LAZY === 'true'
          ? {
              modules: [
                {
                  type: 'ESModule' as const,
                  path: 'entry.mjs',
                  contents: `let api; export default {async fetch(r,e,c){api??=await import('./worker.mjs'); return api.default.fetch(r,e,c)}}`,
                },
                {
                  type: 'ESModule' as const,
                  path: 'worker.mjs',
                  contents: await readFile(
                    process.cwd() + '/.staging/transaction-boundary/api.mjs',
                    'utf8',
                  ),
                },
              ],
            }
          : { scriptPath: process.cwd() + '/.staging/transaction-boundary/api.mjs' }),
        d1Databases: databases,
      },
    ],
  });
  let mf = new Miniflare(options),
    calls = 0,
    batches = 0;
  let db: Record<DatabaseOwner, SqlDatabase>;
  const metrics = { rowsRead: 0, rowsWritten: 0, queries: 0, originClaims: 0 };
  const load = async () =>
    Object.fromEntries(
      await Promise.all(
        DATABASE_OWNERS.map(async (o) => [o, await mf.getD1Database(o, 'boundary-api')]),
      ),
    ) as Record<DatabaseOwner, SqlDatabase>;
  try {
    db = await load();
    if (initialize)
      for (const owner of DATABASE_OWNERS) {
        const role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team';
        const base = process.cwd() + '/workers/multi-d1/migrations/' + role + '/';
        for (const file of (await readdir(base)).filter((f) => f.endsWith('.sql')).sort())
          for (const sql of splitSql(await readFile(base + file, 'utf8')))
            await db[owner].prepare(sql).run();
        await db[owner]
          .prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)')
          .run();
      }
  } catch (e) {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
    throw e;
  }
  const profiler = process.env.DD_GATEWAY_PROFILE_OUT
    ? await (
        await import('../gateway-cpu/profiler')
      ).gatewayProfiler(await mf.getInspectorURL(), process.env.DD_GATEWAY_PROFILE_OUT)
    : undefined;
  const dispatch = (async (input: any, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(input, init);
    calls++;
    let nativeCommand: any;
    try {
      nativeCommand = await r.clone().json();
    } catch {}
    // Fixture metrics contain counts only; no SQL, parameters, assertions or tokens.
    const response = await mf.dispatchFetch(r.url, {
      method: r.method,
      headers: Object.fromEntries(r.headers),
      ...(!['GET', 'HEAD'].includes(r.method) ? { body: await r.arrayBuffer() } : {}),
      redirect: 'manual',
    });
    const reply = new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers as any,
    });
    try {
      const result = await reply.clone().json();
      if (result.success && Array.isArray(result.result)) {
        for (const item of result.result) {
          metrics.rowsRead += item.meta?.rows_read ?? 0;
          metrics.rowsWritten += item.meta?.rows_written ?? 0;
          metrics.queries++;
        }
        metrics.originClaims += (nativeCommand?.queries ?? []).filter((q: any) =>
          q.sql.startsWith('INSERT INTO app_assertions(nonce,ok) VALUES(?,CASE WHEN'),
        ).length;
      }
    } catch {}
    return reply;
  }) as typeof fetch;
  const bindings = createWorkerBindings({
    configuration,
    ...(process.env.DD_TEST_PAYLOAD_ENCODING
      ? { payloadEncoding: process.env.DD_TEST_PAYLOAD_ENCODING as 'hex' }
      : {}),
    ...(process.env.DD_TEST_PAYLOAD_CHUNK_BYTES
      ? { payloadChunkBytes: Number(process.env.DD_TEST_PAYLOAD_CHUNK_BYTES) }
      : {}),
    request: async (input, init) => {
      const r = input instanceof Request ? input : new Request(input, init);
      const command = await r.clone().json();
      if (command.batch === true) batches++;
      if (profiler && process.env.DD_GATEWAY_PROFILE_PHASE) {
        const params = command.queries.flatMap((q: any) => q.params);
        return profiler.measure(
          {
            phase: process.env.DD_GATEWAY_PROFILE_PHASE,
            owner: command.owner,
            batch: command.batch,
            queries: command.queries.length,
            sqlBytes: command.queries.reduce(
              (n: number, q: any) => n + Buffer.byteLength(q.sql),
              0,
            ),
            blobBase64Bytes: params.reduce((n: number, p: any) => n + (p?.blob?.length ?? 0), 0),
            bodyBytes:
              Number(r.headers.get('content-length')) || Buffer.byteLength(await r.clone().text()),
          },
          () => dispatch(r),
        );
      }
      return dispatch(r);
    },
  });
  return {
    get metrics() {
      return { ...metrics };
    },
    bindings,
    configuration,
    dispatch,
    h: {
      get db() {
        return db;
      },
    },
    get calls() {
      return calls;
    },
    get batches() {
      return batches;
    },
    async restart() {
      await mf.dispose();
      mf = new Miniflare(options);
      db = await load();
    },
    async close() {
      profiler?.close();
      await mf.dispose();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
