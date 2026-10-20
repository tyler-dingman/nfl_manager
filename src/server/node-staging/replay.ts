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
  const id = `origin:v1:${expires}:${nonce}`;
  // CHECK(ok=1) makes a missing/locked epoch fail the nonce INSERT itself.
  // This preserves the previous guard's rollback semantics without inserting
  // and deleting an extra guard row on every signed read/write request.
  const results = await db.batch([
    db
      .prepare(
        'INSERT INTO app_assertions(nonce,ok) VALUES(?,CASE WHEN (SELECT locked FROM app_storage_epoch WHERE id=1)=0 THEN 1 ELSE 0 END)',
      )
      .bind(id),
    db
      .prepare(
        'DELETE FROM app_assertions WHERE nonce IN (SELECT nonce FROM app_assertions WHERE nonce>=? AND nonce<? ORDER BY nonce LIMIT 64)',
      )
      .bind('origin:v1:', `origin:v1:${now}:`),
  ]);
  if (results.some((r) => !r.success)) throw Error('Origin nonce claim failed');
}
