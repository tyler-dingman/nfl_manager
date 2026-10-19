import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Storage,
  type SqlDatabase,
  type Objects,
  type Statement,
} from '../../../packages/storage/core';
const symbol = Symbol.for('down-distance.application-bindings');
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
export interface ApplicationBindings {
  db: SqlDatabase;
  objects: Objects;
  cacheNamespace?: string;
  password?: { fetch(request: Request): Promise<Response> };
  ai?: { run(model: string, input: unknown): Promise<unknown> };
  env?: Record<string, string | undefined>;
}
const context = (globals[symbol] ??=
  new AsyncLocalStorage<ApplicationBindings>()) as AsyncLocalStorage<ApplicationBindings>;
export const withApplicationBindings = <T>(bindings: ApplicationBindings, operation: () => T) =>
  context.run(bindings, operation);
export function applicationBackend() {
  const value =
    context.getStore()?.env?.APP_DATA_BACKEND ?? process.env.APP_DATA_BACKEND ?? 'postgres';
  if (!['postgres', 'd1'].includes(value)) throw Error('Unsupported APP_DATA_BACKEND');
  return value;
}
export function applicationEnvironment() {
  return { ...process.env, ...context.getStore()?.env };
}
export function applicationAi() {
  const ai = context.getStore()?.ai;
  if (!ai) throw Error('Workers AI binding is unavailable');
  return ai;
}
let local: Storage | undefined;
export function applicationStorage() {
  const scoped = context.getStore();
  if (scoped) return new Storage(scoped.db, scoped.objects);
  if (local) return local;
  const endpoint = process.env.APP_D1_LOCAL_URL,
    token = process.env.APP_D1_LOCAL_TOKEN;
  if (!endpoint || !token || token.length < 32 || process.env.APP_D1_LOCAL_ENABLED !== 'true')
    throw Error('D1 bindings are required; PostgreSQL fallback is forbidden');
  const url = new URL(endpoint);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.protocol !== 'http:' ||
    url.username ||
    url.password
  )
    throw Error('D1 local bridge must be loopback HTTP');
  const rpc = async <T = unknown>(body: unknown): Promise<T> => {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Error(`D1 local bridge failed (${r.status})`);
    return (await r.json()) as T;
  };
  class LocalStatement implements Statement {
    constructor(
      readonly sql: string,
      readonly values: unknown[] = [],
    ) {}
    bind(...values: unknown[]) {
      return new LocalStatement(this.sql, values);
    }
    async all<T>() {
      return (
        await rpc<Awaited<ReturnType<Statement['all']>>[]>({
          op: 'sql',
          statements: [{ sql: this.sql, values: this.values }],
        })
      )[0] as Awaited<ReturnType<Statement['all']>> & { results: T[] };
    }
    run() {
      return this.all<Record<string, unknown>>();
    }
    async first<T>() {
      return (await this.all<T>()).results[0] ?? null;
    }
  }
  const db: SqlDatabase = {
    prepare: (sql) => new LocalStatement(sql),
    batch: async (statements) =>
      rpc<Awaited<ReturnType<SqlDatabase['batch']>>>({
        op: 'sql',
        statements: statements.map((s) => ({
          sql: (s as LocalStatement).sql,
          values: (s as LocalStatement).values,
        })),
      }),
  };
  const objects: Objects = {
    get: async (key) => {
      const value = await rpc<number[] | null>({ op: 'get', key });
      return value === null ? null : new Uint8Array(value);
    },
    putImmutable: async (key, bytes) => {
      await rpc({ op: 'put', key, bytes: Array.from(bytes) });
    },
  };
  return (local = new Storage(db, objects));
}

const cacheIds = new WeakMap<object, string>();
export function applicationPublicCacheScope() {
  const scoped = context.getStore();
  if (!scoped)
    return applicationBackend() === 'd1'
      ? 'd1:loopback:' + String(process.env.APP_D1_LOCAL_URL)
      : 'postgres:default';
  if (scoped.cacheNamespace) return scoped.cacheNamespace;
  let id = cacheIds.get(scoped.db);
  if (!id) {
    id = crypto.randomUUID();
    cacheIds.set(scoped.db, id);
  }
  return applicationBackend() + ':' + id;
}

export function applicationPasswordService() {
  const service = context.getStore()?.password;
  if (!service) throw Error('Password service binding is unavailable');
  return service;
}
export function passwordRuntimeAvailable() {
  return (
    applicationEnvironment().APP_RUNTIME !== 'cloudflare' ||
    (applicationEnvironment().APP_PASSWORD_ENABLED === 'true' &&
      Boolean(context.getStore()?.password))
  );
}
