import { Storage } from './core';
/** Bounded retention only for consumed, long-expired capabilities and derived
 * inference indexes. User/game/bet/editorial records are never eligible. Exact
 * original token rows are archived and verified before D1 removal. */
export async function maintainTemporaryData(s: Storage, now = Date.now(), limit = 15) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw Error('Maintenance batch limit');
  const cutoff = now - 30 * 86400000;
  const rows = await s.rows<any>(
    'SELECT * FROM app_tokens WHERE expires_at<? AND consumed_at IS NOT NULL ORDER BY expires_at,id LIMIT ?',
    [cutoff, limit],
  );
  if (rows.length) {
    const hash = await s.put({ schema: 1, table: 'app_tokens', rows });
    const nonce = crypto.randomUUID();
    const statements = rows.flatMap((row) => [
      s.statement('DELETE FROM app_tokens WHERE id=? AND expires_at=? AND consumed_at=?', [
        row.id,
        row.expires_at,
        row.consumed_at,
      ]),
      s.guard(nonce + row.id),
      s.unguard(nonce + row.id),
    ]);
    // At most 15 tokens per atomic batch (46 statements including directory).
    for (let i = 0; i < rows.length; i += 15) {
      const chunk = rows.slice(i, i + 15),
        part = statements.slice(i * 3, (i + 15) * 3);
      part.push(
        s.statement(
          'INSERT INTO app_history_packs(id,kind,object_hash,rows,created_at) VALUES(?,?,?,?,?)',
          [nonce + ':' + i, 'EXPIRED_CONSUMED_TOKEN', hash, chunk.length, now],
        ),
      );
      await s.batch(part);
    }
  }
  const result = await s
    .statement(
      'DELETE FROM app_ai_cache WHERE cache_key IN (SELECT cache_key FROM app_ai_cache WHERE expires_at<? AND lease_until<? ORDER BY expires_at,cache_key LIMIT ?)',
      [cutoff, now, 1000],
    )
    .run();
  return { archivedConsumedTokens: rows.length, expiredDerivedKeys: result.meta.changes ?? 0 };
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
