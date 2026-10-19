import { Storage, type Statement } from './core';
import { guardedBatch } from './atomic';
/** Explicitly invoked account erasure. Plan only occupied FK descendants; one atomic
 * D1 batch or fail closed. Shared records use their declared SET NULL policy.
 * No R2 object is deleted here: backups follow the documented recovery retention. */
export async function eraseD1Account(s: Storage, user: string) {
  const quote = (id: string) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) throw Error('Invalid schema identifier');
    return '"' + id + '"';
  };
  const tables = await s.rows<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%' AND sql NOT LIKE 'CREATE VIRTUAL%'",
  );
  const edges = new Map<string, { table: string; from: string[]; to: string[] }[]>();
  for (const { name } of tables) {
    const fks = await s.rows<any>('PRAGMA foreign_key_list(' + quote(name) + ')'),
      groups = new Map<number, any[]>();
    for (const fk of fks) groups.set(fk.id, [...(groups.get(fk.id) ?? []), fk]);
    for (const group of groups.values()) {
      group.sort((a, b) => a.seq - b.seq);
      const fk = group[0];
      if (['SET NULL', 'SET DEFAULT'].includes(fk.on_delete) || name === fk.table) continue;
      edges.set(fk.table, [
        ...(edges.get(fk.table) ?? []),
        { table: name, from: group.map((f) => f.from), to: group.map((f) => f.to || 'id') },
      ]);
    }
  }
  const plans = new Map<string, { where: string; values: unknown[] }>(),
    order: string[] = [],
    visiting = new Set<string>();
  async function plan(table: string, where: string, values: unknown[]) {
    if (visiting.has(table)) throw Error('Account erasure requires a cyclic-relation migration');
    if (
      !(await s.rows('SELECT 1 FROM ' + quote(table) + ' WHERE ' + where + ' LIMIT 1', values))
        .length
    )
      return;
    const prior = plans.get(table);
    plans.set(
      table,
      prior
        ? { where: '(' + prior.where + ') OR(' + where + ')', values: [...prior.values, ...values] }
        : { where, values: [...values] },
    );
    visiting.add(table);
    for (const edge of edges.get(table) ?? []) {
      const left =
        edge.from.length === 1 ? quote(edge.from[0]) : '(' + edge.from.map(quote).join(',') + ')';
      await plan(
        edge.table,
        left +
          ' IN(SELECT ' +
          edge.to.map(quote).join(',') +
          ' FROM ' +
          quote(table) +
          ' WHERE ' +
          where +
          ')',
        values,
      );
    }
    visiting.delete(table);
    if (!order.includes(table)) order.push(table);
  }
  await plan('app_users', 'id=?', [user]);
  if (!plans.size) return;
  const audit = await s.put({ reason: 'user_requested' }),
    writes: Statement[] = order
      .filter((t) => t !== 'app_users')
      .map((t) => {
        const p = plans.get(t)!;
        return s.statement('DELETE FROM ' + quote(t) + ' WHERE ' + p.where, p.values);
      });
  // SET NULL relationships are handled by SQLite; audit becomes anonymous with deletion.
  writes.push(
    s.statement(
      "INSERT INTO app_security_audit(id,user_id,event_type,metadata_hash,created_at) VALUES(?,NULL,'ACCOUNT_DELETED',?,?)",
      [crypto.randomUUID(), audit, Date.now()],
    ),
    s.statement('DELETE FROM app_users WHERE id=?', [user]),
  );
  if (writes.length + 2 > 50)
    throw Error('Account erasure exceeds the atomic D1 batch; no data was deleted.');
  await guardedBatch(
    s,
    [{ sql: 'EXISTS(SELECT 1 FROM app_users WHERE id=?)', values: [user] }],
    writes,
  );
}
