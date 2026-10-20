import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { multiHarness } from '../../workers/content-engine/test/multi-harness';
import { DATABASE_OWNERS, type DatabaseOwner } from '../../packages/storage/multi-d1';
import { createRestBindings } from '../../src/server/node-staging/d1-rest';
export const ids = Object.fromEntries(
  DATABASE_OWNERS.map((o, i) => [o, '00000000-0000-0000-0000-' + String(i + 1).padStart(12, '0')]),
) as Record<DatabaseOwner, string>;
export const fixtureToken = 'synthetic-fixture-token-not-a-live-account-credential';
export async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + (server.address() as any).port;
}
export const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((e) => (e ? reject(e) : resolve()));
  });
export async function restFixture(initialize = true) {
  const h = await multiHarness(initialize);
  let calls = 0,
    batches = 0;
  const shapes: { owner: DatabaseOwner; batch: boolean; statements: number }[] = [];
  if (initialize)
    for (const owner of DATABASE_OWNERS)
      await h.db[owner]
        .prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)')
        .run();
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + fixtureToken) {
        res.writeHead(403);
        res.end();
        return;
      }
      const match = req.url?.match(
          /^\/client\/v4\/accounts\/[a-f0-9]{32}\/d1\/database\/([a-f0-9-]{36})\/query$/,
        ),
        owner = DATABASE_OWNERS.find((o) => ids[o] === match?.[1]);
      if (!owner) throw Error('Unknown owner');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString()),
        isBatch = Array.isArray(body.batch),
        queries = isBatch ? body.batch : [body];
      calls++;
      if (isBatch) batches++;
      shapes.push({ owner, batch: isBatch, statements: queries.length });
      const statements = queries.map((q: any) =>
        h.db[owner].prepare(q.sql).bind(...(q.params ?? [])),
      );
      // This fixture deliberately supplies the binding's documented atomic batch contract.
      const result = isBatch ? await h.db[owner].batch(statements) : [await statements[0].all()];
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({ success: true, result }, (_key, value) =>
          value instanceof ArrayBuffer ? Array.from(new Uint8Array(value)) : value,
        ),
      );
    } catch (error) {
      const message =
        /CHECK constraint failed.*app_assertions|CHECK constraint failed.*ok.?=.?1/i.test(
          String(error),
        )
          ? 'CHECK constraint failed: app_assertions'
          : /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(String(error))
            ? 'SQLITE_CONSTRAINT'
            : 'Synthetic query rejected';
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          errors: [{ code: 7500, message }],
        }),
      );
    }
  });
  const url = await listen(server),
    options = {
      accountId: '00000000000000000000000000000000',
      databaseIds: ids,
      token: fixtureToken,
      endpoint: url + '/client/v4',
      localAtomicFixture: true,
    };
  return {
    h,
    url,
    options,
    bindings: createRestBindings(options),
    get calls() {
      return calls;
    },
    get batches() {
      return batches;
    },
    shapes,
    async close() {
      await close(server);
      await h.close();
    },
  };
}
