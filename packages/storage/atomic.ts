import { Storage, type Statement } from './core';
/** Preconditions and writes share one D1 transaction. Reads before this batch
 * are hints only; every authorization/CAS invariant must appear in a guard. */
export async function guardedBatch(
  s: Storage,
  guards: { sql: string; values?: unknown[] }[],
  writes: Statement[],
  message = 'State changed or operation is no longer permitted. Please retry.',
) {
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
