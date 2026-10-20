import 'node:process';
import { splitSql } from '../../../packages/storage/sql-script';
import type { SqlDatabase, Statement } from '../../../packages/storage/core';
import { DATABASE_OWNERS, type DatabaseOwner } from '../../../packages/storage/multi-d1';
export class RestAtomicityUnverified extends Error {
  constructor() {
    super('Remote D1 REST atomicity is unverified; writes and batches are disabled.');
    this.name = 'RestAtomicityUnverified';
  }
}
export class D1RestError extends Error {
  constructor(readonly status = 503) {
    super('D1 REST unavailable; no automatic retry; mutation outcome may be unknown.');
    this.name = 'D1RestError';
  }
}
export type RestOptions = {
  accountId: string;
  databaseIds: Record<DatabaseOwner, string>;
  token: string;
  endpoint?: string;
  request?: typeof fetch;
  localAtomicFixture?: boolean;
};
type Query = { sql: string; params: unknown[] };
class RestStatement implements Statement {
  constructor(
    readonly database: RestDatabase,
    readonly query: Query,
  ) {}
  bind(...values: unknown[]) {
    if (values.length > 100) throw Error('D1 parameter budget exceeded');
    return new RestStatement(this.database, { sql: this.query.sql, params: values.map(parameter) });
  }
  async all<T = Record<string, unknown>>() {
    return (await this.database.execute([this.query], false))[0] as Awaited<
      ReturnType<Statement['all']>
    > & { results: T[] };
  }
  run() {
    return this.all();
  }
  async first<T>() {
    return (await this.all<T>()).results[0] ?? null;
  }
}
function parameter(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value))
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  throw Error('Unsupported D1 bound parameter');
}
class RestDatabase implements SqlDatabase {
  constructor(
    readonly owner: DatabaseOwner,
    readonly id: string,
    readonly options: RestOptions,
    readonly reserve: () => void,
  ) {}
  prepare(sql: string) {
    if (!sql.trim() || new TextEncoder().encode(sql).length > 100000)
      throw Error('Invalid D1 statement size');
    if (splitSql(sql).length !== 1) throw Error('Exactly one D1 statement required');
    return new RestStatement(this, { sql, params: [] });
  }
  async batch(statements: Statement[]) {
    if (!statements.length || statements.length > 50) throw Error('Invalid D1 batch size');
    const queries = statements.map((s) => {
      if (!(s instanceof RestStatement) || s.database !== this)
        throw Error('Cross-database statement rejected');
      return s.query;
    });
    return this.execute(queries, true);
  }
  async execute(queries: Query[], batch: boolean) {
    const endpoint = this.options.endpoint ?? 'https://api.cloudflare.com/client/v4';
    const local =
      new URL(endpoint).protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname);
    const atomicFixture = local && this.options.localAtomicFixture === true;
    // A batch-shaped REST body is not proof of rollback semantics. No remote override exists.
    if (!atomicFixture && (batch || queries.some((q) => !/^\s*(SELECT\b|EXPLAIN\b)/i.test(q.sql))))
      throw new RestAtomicityUnverified();
    this.reserve();
    let response: Response;
    try {
      response = await (this.options.request ?? fetch)(
        `${endpoint}/accounts/${this.options.accountId}/d1/database/${this.id}/query`,
        {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: {
            authorization: 'Bearer ' + this.options.token,
            'content-type': 'application/json',
          },
          body: JSON.stringify(batch ? { batch: queries } : queries[0]),
        },
      );
    } catch {
      throw new D1RestError();
    }

    let data: any;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new D1RestError();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 16 * 1024 * 1024) {
          await reader.cancel();
          throw new D1RestError();
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new D1RestError();
    }
    if (!response.ok || data.success !== true) {
      const messages = (Array.isArray(data.errors) ? data.errors : [])
        .map((e: any) => String(e.message ?? ''))
        .join(' ');
      if (
        /CHECK constraint failed.*app_assertions|CHECK constraint failed.*ok.?=.?1/i.test(messages)
      )
        throw Error('CHECK constraint failed: app_assertions');
      if (/UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(messages))
        throw Error('SQLITE_CONSTRAINT');
      throw new D1RestError(response.status);
    }
    if (
      data.success !== true ||
      !Array.isArray(data.result) ||
      data.result.length !== queries.length ||
      data.result.some((r: any) => r.success !== true || !Array.isArray(r.results) || !r.meta)
    )
      throw new D1RestError();
    return data.result.map((r: any) => ({
      success: true,
      results: r.results,
      meta: Object.fromEntries(
        Object.entries(r.meta).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
      ),
    }));
  }
}
/** Server-only, owner-fixed IDs; one HTTP batch, never a loop of sequential writes. */
export function createRestBindings(options: RestOptions): Record<DatabaseOwner, SqlDatabase> {
  if (typeof window !== 'undefined') throw Error('D1 REST is server-only');
  options = Object.freeze({ ...options, databaseIds: Object.freeze({ ...options.databaseIds }) });
  if (!/^[a-f0-9]{32}$/.test(options.accountId) || options.token.length < 24)
    throw Error('Invalid private D1 configuration');
  const url = new URL(options.endpoint ?? 'https://api.cloudflare.com/client/v4');
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      (url.origin === 'https://api.cloudflare.com' && url.pathname === '/client/v4') ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    )
  )
    throw Error('D1 endpoint is not approved');
  if (
    options.localAtomicFixture &&
    !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  )
    throw Error('Local atomic fixture cannot target Cloudflare');
  const ids = DATABASE_OWNERS.map((o) => options.databaseIds[o]);
  if (
    new Set(ids).size !== 10 ||
    ids.some((id) => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
  )
    throw Error('Ten distinct owner database UUIDs required');
  const requests: number[] = [];
  const reserve = () => {
    const now = Date.now();
    while (requests[0] < now - 300000) requests.shift();
    if (requests.length >= (options.localAtomicFixture ? 10000 : 600)) throw new D1RestError(429);
    requests.push(now);
  };
  return Object.fromEntries(
    DATABASE_OWNERS.map((owner) => [
      owner,
      new RestDatabase(owner, options.databaseIds[owner], options, reserve),
    ]),
  ) as unknown as Record<DatabaseOwner, SqlDatabase>;
}
