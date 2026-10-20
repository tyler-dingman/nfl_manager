import { DATABASE_OWNERS, type DatabaseOwner } from '../../packages/storage/multi-d1';
import { splitSql } from '../../packages/storage/sql-script';
import { verifyOriginRequest } from '../../packages/security/origin-assertion';
import {
  TRANSACTION_PATH,
  transactionConfiguration,
} from '../../packages/security/transaction-boundary';
/** Existing private API Worker only. Web gateway claims the nonce before service dispatch.
 * No public route/config is created. Never expose this entrypoint via workers_dev/routes. */
export default {
  async fetch(request: Request, env: any) {
    if (new URL(request.url).pathname !== TRANSACTION_PATH)
      return new Response('Private transaction executor', { status: 403 });
    let verified: Request;
    try {
      if (request.method !== 'POST') throw Error('Method denied');
      // Signature is rechecked across the binding boundary. Replay is claimed by Web,
      // which is the sole externally reachable caller; this Worker remains private.
      verified = await verifyOriginRequest(request, transactionConfiguration(env), async () => {});
    } catch {
      return Response.json({ success: false }, { status: 403 });
    }
    try {
      const body = await verified.json();
      if (
        !DATABASE_OWNERS.includes(body.owner) ||
        typeof body.batch !== 'boolean' ||
        !Array.isArray(body.queries) ||
        !body.queries.length ||
        body.queries.length > 50 ||
        (!body.batch && body.queries.length !== 1)
      )
        throw Error('Invalid native command');
      const db = env[body.owner as DatabaseOwner];
      if (!db) throw Error('Owner binding absent');
      const statements = body.queries.map((q: any) => {
        if (
          typeof q.sql !== 'string' ||
          new TextEncoder().encode(q.sql).length > 100000 ||
          splitSql(q.sql).length !== 1 ||
          !(
            /^\s*(SELECT|EXPLAIN|INSERT|UPDATE|DELETE|WITH)\b/i.test(q.sql) ||
            (/^\s*PRAGMA\s+(foreign_key_list|table_info|foreign_key_check|quick_check|page_count|page_size)\b/i.test(
              q.sql,
            ) &&
              !q.sql.includes('='))
          ) ||
          !Array.isArray(q.params) ||
          q.params.length > 100
        )
          throw Error('Invalid statement');
        const params = q.params.map((v: any) => {
          if (v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
            return v;
          if (
            v &&
            typeof v === 'object' &&
            Object.keys(v).length === 1 &&
            typeof v.blob === 'string' &&
            v.blob.length <= 2666668 &&
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.blob)
          ) {
            const bytes = Uint8Array.from(atob(v.blob), (c) => c.charCodeAt(0));
            if (bytes.length > 2000000) throw Error('Blob budget exceeded');
            return bytes.buffer;
          }
          throw Error('Invalid bound value');
        });
        return db.prepare(q.sql).bind(...params);
      });
      // Exactly ONE native batch. Never sequential execution or splitting on failure.
      const result = body.batch ? await db.batch(statements) : [await statements[0].all()];
      return new Response(
        JSON.stringify({ success: true, result }, (_k, v) =>
          v instanceof ArrayBuffer ? Array.from(new Uint8Array(v)) : v,
        ),
        {
          headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
        },
      );
    } catch (error) {
      const message =
        /CHECK constraint failed.*app_assertions|CHECK constraint failed.*ok.?=.?1/i.test(
          String(error),
        )
          ? 'CHECK constraint failed: app_assertions'
          : /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(String(error))
            ? 'SQLITE_CONSTRAINT'
            : 'Native transaction rejected';
      return Response.json(
        { success: false, message },
        { status: 409, headers: { 'cache-control': 'private, no-store' } },
      );
    }
  },
};
