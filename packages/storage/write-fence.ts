import type { SqlDatabase, Statement } from './core';
export class StorageMaintenanceError extends Error {
  constructor() {
    super('Storage maintenance changed the write epoch; retry the whole request');
  }
}
/** All D1 application adapters share this request-scoped fence through Objects.
 * A writer that read/uploaded before maintenance cannot publish after GC.
 * Owner SQL/imports must be stopped: raw database access bypasses this SDK. */
export type WriteFenceContext = { captured?: Promise<number> };
export function writeFencedDatabase(
  raw: SqlDatabase,
  context: WriteFenceContext = {},
): SqlDatabase {
  async function loadEpoch() {
    let row = await raw
      .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
      .first<{ epoch: number; locked: number }>();
    if (!row) {
      await raw
        .prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)')
        .run();
      row = await raw
        .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
        .first<{ epoch: number; locked: number }>();
    }
    if (!row || row.locked) throw new StorageMaintenanceError();
    return row.epoch;
  }
  async function epoch() {
    context.captured ??= loadEpoch();
    return context.captured;
  }
  async function read<T>(statement: Statement) {
    // Native gateway only: capture the same epoch and first read in ONE native
    // read-only batch. No cached authorization and no extra statement budget.
    if (raw.payloadChunkBytes !== undefined && !context.captured) {
      const combined = raw.batch([
        raw.prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1'),
        statement,
      ]);
      context.captured = combined.then(async (rows) => {
        if (rows.some((r) => !r.success)) throw new StorageMaintenanceError();
        const row = rows[0].results[0] as { epoch: number; locked: number } | undefined;
        if (!row) return loadEpoch();
        if (row.locked) throw new StorageMaintenanceError();
        return row.epoch;
      });
      await context.captured;
      const results = await combined;
      return results[1] as Awaited<ReturnType<Statement['all']>> & { results: T[] };
    }
    await epoch();
    return statement.all<T>();
  }
  const native = new WeakMap<Statement, { statement: Statement; sql: string }>();
  const readOnly = (sql: string) => /^\s*(SELECT\b|EXPLAIN\b)/i.test(sql);
  async function commit(statements: Statement[]) {
    const version = await epoch(),
      token = crypto.randomUUID();
    if (statements.length > 48) throw Error('Fenced D1 batch exceeds 48 statements');
    let results;
    try {
      results = await raw.batch([
        raw
          .prepare(
            'INSERT INTO app_storage_guards(id,ok) SELECT ?,CASE WHEN epoch=? AND locked=0 THEN 1 ELSE 0 END FROM app_storage_epoch WHERE id=1',
          )
          .bind(token, version),
        ...statements,
        raw.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token),
      ]);
    } catch (error) {
      const current = await raw
        .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
        .first<{ epoch: number; locked: number }>();
      if (!current || current.epoch !== version || current.locked)
        throw new StorageMaintenanceError();
      throw error;
    }
    if (results.some((r) => !r.success)) throw new StorageMaintenanceError();
    return results.slice(1, -1);
  }
  function wrap(statement: Statement, sql: string): Statement {
    const wrapped: Statement = {
      bind: (...values) => wrap(statement.bind(...values), sql),
      all: async <T>() =>
        (readOnly(sql) ? await read<T>(statement) : (await commit([statement]))[0]) as Awaited<
          ReturnType<Statement['all']>
        > & { results: T[] },
      run: async () => (readOnly(sql) ? read(statement) : (await commit([statement]))[0]),
      first: async <T>() => (await wrapped.all<T>()).results[0] ?? null,
    };
    native.set(wrapped, { statement, sql });
    return wrapped;
  }
  return {
    prepare: (sql) => wrap(raw.prepare(sql), sql),
    batch: async (statements) => {
      await epoch();
      const entries = statements.map((s) => native.get(s) ?? { statement: s, sql: '' });
      if (entries.every((e) => readOnly(e.sql))) return raw.batch(entries.map((e) => e.statement));
      return commit(entries.map((e) => e.statement));
    },
  };
}
