import type { SqlDatabase, Statement } from './core';
export class StorageMaintenanceError extends Error {
  constructor() {
    super('Storage maintenance changed the write epoch; retry the whole request');
  }
}
/** All D1 application adapters share this request-scoped fence through Objects.
 * A writer that read/uploaded before maintenance cannot publish after GC.
 * Owner SQL/imports must be stopped: raw database access bypasses this SDK. */
export function writeFencedDatabase(raw: SqlDatabase): SqlDatabase {
  let captured: Promise<number> | undefined;
  async function epoch() {
    captured ??= (async () => {
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
    })();
    return captured;
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
      all: async <T>() => {
        await epoch();
        return (
          readOnly(sql) ? await statement.all<T>() : (await commit([statement]))[0]
        ) as Awaited<ReturnType<Statement['all']>> & { results: T[] };
      },
      run: async () => {
        await epoch();
        return readOnly(sql) ? statement.run() : (await commit([statement]))[0];
      },
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
