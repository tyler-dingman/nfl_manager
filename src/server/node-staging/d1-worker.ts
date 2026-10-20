import 'node:process';
import type { SqlDatabase, Statement } from '../../../packages/storage/core';
import { DATABASE_OWNERS, type DatabaseOwner } from '../../../packages/storage/multi-d1';
import { splitSql } from '../../../packages/storage/sql-script';
import {
  signOriginRequest,
  ORIGIN_HEADER,
  type OriginConfiguration,
} from '../../../packages/security/origin-assertion';
import {
  TRANSACTION_PATH,
  TRANSACTION_AUDIENCE,
} from '../../../packages/security/transaction-boundary';
export type WorkerDatabaseOptions = {
  configuration: OriginConfiguration;
  request?: typeof fetch;
  payloadChunkBytes?: number;
  payloadEncoding?: 'hex';
};
type Query = { sql: string; params: unknown[] };
export class NativeBoundaryError extends Error {
  constructor() {
    super('Private native D1 boundary unavailable; no retry; mutation outcome may be unknown.');
    this.name = 'NativeBoundaryError';
  }
}
function value(v: unknown): unknown {
  if (v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
    return v;
  if (v instanceof ArrayBuffer) return { blob: Buffer.from(v).toString('base64') };
  if (ArrayBuffer.isView(v))
    return { blob: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') };
  throw Error('Invalid bound parameter');
}
class Prepared implements Statement {
  constructor(
    readonly db: NativeDatabase,
    readonly query: Query,
  ) {}
  bind(...params: unknown[]) {
    if (params.length > 100) throw Error('Parameter budget exceeded');
    return new Prepared(this.db, { sql: this.query.sql, params: params.map(value) });
  }
  async all<T = Record<string, unknown>>() {
    return (await this.db.execute([this.query], false))[0] as {
      success: boolean;
      results: T[];
      meta: Record<string, number>;
    };
  }
  run() {
    return this.all();
  }
  async first<T>() {
    return (await this.all<T>()).results[0] ?? null;
  }
}
class NativeDatabase implements SqlDatabase {
  get payloadEncoding() {
    return this.options.payloadEncoding;
  }
  get payloadChunkBytes() {
    return this.options.payloadChunkBytes;
  }
  constructor(
    readonly owner: DatabaseOwner,
    readonly options: WorkerDatabaseOptions,
  ) {}
  prepare(sql: string) {
    if (new TextEncoder().encode(sql).length > 100000 || splitSql(sql).length !== 1)
      throw Error('Exactly one bounded statement required');
    return new Prepared(this, { sql, params: [] });
  }
  async batch(statements: Statement[]) {
    if (!statements.length || statements.length > 50) throw Error('Native batch budget exceeded');
    return this.execute(
      statements.map((s) => {
        if (!(s instanceof Prepared) || s.db !== this)
          throw Error('Cross-owner/adapter batch denied');
        return s.query;
      }),
      true,
    );
  }
  async execute(queries: Query[], batch: boolean) {
    // Only server-generated repository statements enter this method. No application
    // route forwards a request's SQL, owner, URL or transaction capability here.
    const request = new Request(this.options.configuration.publicOrigin + TRANSACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: this.owner, batch, queries }),
    });
    const signed = await signOriginRequest(request, this.options.configuration);
    let response: Response, data: any;
    try {
      response = await (this.options.request ?? fetch)(request.url, {
        method: 'POST',
        headers: { [ORIGIN_HEADER]: signed.assertion },
        body: signed.body as BodyInit,
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      const reader = response.body?.getReader();
      if (!reader) throw Error('Empty native response');
      const parts: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.length;
        if (length > 16000000) {
          await reader.cancel();
          throw Error('Native response too large');
        }
        parts.push(next.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const p of parts) {
        bytes.set(p, offset);
        offset += p.length;
      }
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new NativeBoundaryError();
    }
    if (!response.ok || !data.success) {
      if (
        data.message === 'CHECK constraint failed: app_assertions' ||
        data.message === 'SQLITE_CONSTRAINT'
      )
        throw Error(data.message);
      throw new NativeBoundaryError();
    }
    if (
      !Array.isArray(data.result) ||
      data.result.length !== queries.length ||
      data.result.some((r: any) => r.success !== true || !Array.isArray(r.results) || !r.meta)
    )
      throw new NativeBoundaryError();
    return data.result.map((r: any) => ({
      success: true,
      results: r.results,
      meta: Object.fromEntries(
        Object.entries(r.meta).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
      ),
    }));
  }
}
/** Fixed logical owners, no Cloudflare account API token, no direct REST fallback. */
export function createWorkerBindings(
  options: WorkerDatabaseOptions,
): Record<DatabaseOwner, SqlDatabase> {
  if (typeof window !== 'undefined') throw Error('Native binding transport is server-only');
  const configuration = Object.freeze({ ...options.configuration });
  if (
    configuration.publicOrigin !== 'https://down-distance-rc3-staging-web.tdingman5.workers.dev' ||
    configuration.audience !== TRANSACTION_AUDIENCE ||
    configuration.secret.length < 64
  )
    throw Error('Invalid staging boundary');
  if (
    options.payloadChunkBytes !== undefined &&
    ![4096, 8192, 16384, 32768, 65536].includes(options.payloadChunkBytes)
  )
    throw Error('Unqualified payload candidate size');
  if (options.payloadEncoding !== undefined && options.payloadEncoding !== 'hex')
    throw Error('Invalid payload transport');
  const snapshot = Object.freeze({ ...options, configuration });
  return Object.fromEntries(
    DATABASE_OWNERS.map((o) => [o, new NativeDatabase(o, snapshot)]),
  ) as unknown as Record<DatabaseOwner, SqlDatabase>;
}
