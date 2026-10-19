import type { SqlDatabase } from './core';
/** Private binding/owner executor only. No public route. Verification/marking
 * is owner-side; the immutable plan holds the SDK fence until the last step.
 * Each step uses <=10 D1 statements, no object decompression or graph scan. */
export async function maintenanceStep(
  db: SqlDatabase,
  runId: string,
  authorization: 'OWNER_PRIVATE_MAINTENANCE',
) {
  if (authorization !== 'OWNER_PRIVATE_MAINTENANCE')
    throw Error('Explicit private maintenance authorization required');
  const plan = await db
    .prepare('SELECT * FROM app_storage_gc_plans WHERE id=?')
    .bind(runId)
    .first<{ id: string; epoch: number; state: string; last_hash: string }>();
  if (!plan) throw Error('Unknown maintenance plan');
  if (plan.state === 'DONE') return { done: true, deleted: 0, statements: 1 };
  const object = await db
    .prepare(
      'SELECT hash,bytes FROM app_storage_gc_candidates WHERE run_id=? ORDER BY hash LIMIT 1',
    )
    .bind(runId)
    .first<{ hash: string; bytes: number }>();
  const token = crypto.randomUUID();
  const guard = db
    .prepare(
      "INSERT INTO app_storage_guards(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM app_storage_epoch e JOIN app_storage_gc_plans p ON p.epoch=e.epoch WHERE e.id=1 AND e.locked=1 AND p.id=? AND p.state='RUNNING' AND p.last_hash=?) THEN 1 ELSE 0 END",
    )
    .bind(token, runId, plan.last_hash);
  const statements = object
    ? [
        guard,
        db.prepare('DELETE FROM app_payload_chunks WHERE hash=?').bind(object.hash),
        db.prepare('DELETE FROM app_payload_objects WHERE hash=?').bind(object.hash),
        db
          .prepare('UPDATE app_payload_capacity SET used_bytes=used_bytes-? WHERE id=1')
          .bind(object.bytes),
        db
          .prepare(
            'INSERT INTO app_storage_gc_audit(run_id,hash,encoded_bytes,deleted_at) VALUES(?,?,?,?)',
          )
          .bind(runId, object.hash, object.bytes, Date.now()),
        db
          .prepare('DELETE FROM app_storage_gc_candidates WHERE run_id=? AND hash=?')
          .bind(runId, object.hash),
        db
          .prepare('UPDATE app_storage_gc_plans SET last_hash=? WHERE id=?')
          .bind(object.hash, runId),
        db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token),
      ]
    : [
        guard,
        db.prepare("UPDATE app_storage_gc_plans SET state='DONE' WHERE id=?").bind(runId),
        db.prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1'),
        db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token),
      ];
  try {
    const results = await db.batch(statements);
    if (results.some((r) => !r.success)) throw Error('Maintenance transaction failed');
    return { done: !object, deleted: object ? 1 : 0, statements: 2 + statements.length };
  } catch (error) {
    const current = await db
      .prepare('SELECT state,last_hash FROM app_storage_gc_plans WHERE id=?')
      .bind(runId)
      .first<{ state: string; last_hash: string }>();
    if (current && (current.state === 'DONE' || current.last_hash !== plan.last_hash))
      return {
        done: current.state === 'DONE',
        deleted: 0,
        retry: true,
        statements: 3 + statements.length,
      };
    throw error;
  }
}
