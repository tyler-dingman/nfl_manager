import { Storage, type Statement } from './core';
/** Preconditions and writes share one D1 transaction. Reads before this batch
 * are hints only; every authorization/CAS invariant must appear in a guard. */
export async function guardedBatch(
  s: Storage,
  guards: { sql: string; values?: unknown[] }[],
  writes: Statement[],
  message = 'State changed or operation is no longer permitted. Please retry.',
) {
  // Boolean preconditions can share one assertion row without changing the
  // transaction boundary. Preserve the parameter budget for large call sites.
  if (guards.length > 1 && guards.reduce((n, g) => n + (g.values?.length ?? 0), 0) < 100)
    guards = [
      {
        sql: guards.map((g) => `(${g.sql})`).join(' AND '),
        values: guards.flatMap((g) => g.values ?? []),
      },
    ];
  const nonces = guards.map(() => crypto.randomUUID());
  try {
    return await s.batch([
      ...guards.map((g, i) =>
        s.statement(
          `INSERT INTO app_assertions(nonce,ok) SELECT ?,CASE WHEN (${g.sql}) THEN 1 ELSE 0 END`,
          [nonces[i], ...(g.values ?? [])],
        ),
      ),
      ...writes,
      ...nonces.map((n) => s.unguard(n)),
    ]);
  } catch (error) {
    if (/CHECK constraint failed|app_assertions|ok=1/.test(String(error))) throw Error(message);
    throw error;
  }
}
export const iso = (value: number | null | undefined) =>
  value == null ? null : new Date(value).toISOString();
