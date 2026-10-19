import { Storage } from './core';
import { expireDerivedDirectories } from './derived-lifecycle';
/** Bounded retention only for consumed, long-expired capabilities and derived
 * inference indexes. User/game/bet/editorial records are never eligible. Exact
 * original token rows are archived and verified before D1 removal. */
export async function maintainTemporaryData(
  s: Storage,
  now = Date.now(),
  limit = 15,
  derivedStorage: Storage = s,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw Error('Maintenance batch limit');
  const cutoff = now - 30 * 86400000;
  const rows = await s.rows<any>(
    'SELECT * FROM app_tokens WHERE expires_at<? AND consumed_at IS NOT NULL ORDER BY expires_at,id LIMIT ?',
    [cutoff, limit],
  );
  if (rows.length) {
    const hash = await s.put({ schema: 1, table: 'app_tokens', rows });
    const nonce = crypto.randomUUID();
    // Exact token tuples and the archived pack commit together. A concurrent
    // change makes the guard fail and rolls back every deletion.
    await s.batch([
      s.statement(
        "DELETE FROM app_tokens WHERE (id,expires_at,consumed_at) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?))",
        [JSON.stringify(rows.map((row) => [row.id, row.expires_at, row.consumed_at]))],
      ),
      s.statement(
        'INSERT INTO app_storage_guards(id,ok) VALUES(?,CASE WHEN changes()=? THEN 1 ELSE 0 END)',
        [nonce, rows.length],
      ),
      s.statement(
        'INSERT INTO app_history_packs(id,kind,object_hash,rows,created_at) VALUES(?,?,?,?,?)',
        [nonce + ':0', 'EXPIRED_CONSUMED_TOKEN', hash, rows.length, now],
      ),
      s.statement('DELETE FROM app_storage_guards WHERE id=?', [nonce]),
    ]);
  }
  const result = await expireDerivedDirectories(derivedStorage, now);
  return { ...result, archivedConsumedTokens: rows.length };
}
export class D1ApplicationSettings {
  constructor(readonly s: Storage) {}
  async read(key: string) {
    const [row] = await this.s.rows<{ value_json: string; version: number }>(
      'SELECT value_json,version FROM app_application_settings WHERE key=?',
      [key],
    );
    return row ? { value: JSON.parse(row.value_json), version: row.version } : null;
  }
  async compareAndSet(key: string, version: number, value: unknown) {
    const json = JSON.stringify(value);
    if (
      !key ||
      key.length > 160 ||
      !Number.isSafeInteger(version) ||
      version < 0 ||
      !json ||
      new TextEncoder().encode(json).length > 32000
    )
      throw Error('Invalid settings command');
    const result = await this.s
      .statement(
        version === 0
          ? 'INSERT INTO app_application_settings(key,value_json) VALUES(?,?) ON CONFLICT DO NOTHING'
          : 'UPDATE app_application_settings SET value_json=?,version=version+1 WHERE key=? AND version=?',
        version === 0 ? [key, json] : [json, key, version],
      )
      .run();
    return result.meta.changes === 1;
  }
}
