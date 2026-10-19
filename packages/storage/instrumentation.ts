import type { SqlDatabase, Statement } from './core';
export interface RequestMetrics {
  d1Calls: number;
  statements: number;
  rowsRead: number;
  rowsWritten: number;
}
export const requestMetrics = (): RequestMetrics => ({
  d1Calls: 0,
  statements: 0,
  rowsRead: 0,
  rowsWritten: 0,
});
/** Counts returned D1 metadata, not an inferred row count or billed Worker CPU. */
export class QueryBudgetError extends Error {
  constructor() {
    super('This operation is temporarily unavailable. Please try again later.');
    this.name = 'QueryBudgetError';
  }
}
export function instrumentDatabase(
  db: SqlDatabase,
  metrics: RequestMetrics,
  maxStatements?: number,
): SqlDatabase {
  const reserve = (count: number) => {
    if (maxStatements !== undefined && metrics.statements + count > maxStatements)
      throw new QueryBudgetError();
    metrics.d1Calls++;
    metrics.statements += count;
  };
  const originals = new WeakMap<Statement, Statement>();
  function record(result: { meta: Record<string, number> }) {
    metrics.rowsRead += result.meta.rows_read ?? 0;
    metrics.rowsWritten += result.meta.rows_written ?? 0;
  }
  function wrap(statement: Statement): Statement {
    const wrapped: Statement = {
      bind: (...values) => wrap(statement.bind(...values)),
      all: async <T>() => {
        reserve(1);
        const r = await statement.all<T>();
        record(r);
        return r;
      },
      run: async () => {
        reserve(1);
        const r = await statement.run();
        record(r);
        return r;
      },
      first: async <T>() => (await wrapped.all<T>()).results[0] ?? null,
    };
    originals.set(wrapped, statement);
    return wrapped;
  }
  return {
    prepare: (sql) => wrap(db.prepare(sql)),
    batch: async (statements) => {
      reserve(statements.length);
      const result = await db.batch(statements.map((s) => originals.get(s) ?? s));
      result.forEach(record);
      return result;
    },
  };
}
export function routeFamily(path: string) {
  const paths = [
    '/api/auth',
    '/api/search',
    '/api/automation',
    '/api/front-office',
    '/api/parlay',
    '/api/user',
    '/front-office',
    '/parlay-lab',
    '/the-beat',
    '/watch',
    '/three-and-out',
    '/trivia',
  ];
  return path === '/'
    ? '/'
    : (paths.find((p) => path === p || path.startsWith(p + '/')) ?? 'other');
}
