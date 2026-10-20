import type { SqlDatabase } from '../../../packages/storage/core';
/** Existing assertion table, reserved namespace. Survives restarts; unique insert serializes replicas. */
export async function claimOriginNonce(db: SqlDatabase, nonce: string, expires: number) {
  const now = Math.floor(Date.now() / 1000);
  if (
    !/^[A-Za-z0-9_-]{32}$/.test(nonce) ||
    !Number.isInteger(expires) ||
    expires < 1000000000 ||
    expires >= 10000000000
  )
    throw Error('Origin denied');
  const id = `origin:v1:${expires}:${nonce}`,
    guard = 'origin-claim:' + crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        'INSERT INTO app_assertions(nonce,ok) SELECT ?,1 FROM app_storage_epoch WHERE id=1 AND locked=0',
      )
      .bind(id),
    db.prepare('INSERT INTO app_assertions(nonce,ok) VALUES(?,changes())').bind(guard),
    db.prepare('DELETE FROM app_assertions WHERE nonce=?').bind(guard),
    db
      .prepare(
        "DELETE FROM app_assertions WHERE nonce IN (SELECT nonce FROM app_assertions WHERE nonce LIKE 'origin:v1:%' AND substr(nonce,11,10)<? LIMIT 64)",
      )
      .bind(String(now)),
  ]);
}
