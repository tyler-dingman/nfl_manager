import { Storage } from './core';
import { guardedBatch } from './atomic';
import plan from './account-erasure-plan.json';
/** Start only after the authenticated HTTP handler checks origin and DELETE confirmation.
 * Deactivation, profile scrubbing and durable intent commit atomically. No capability
 * returned here can authorize erasure of another account. The operator resumes jobs.
 */
export async function requestMultiD1Erasure(s: Storage, user: string, transferActor: string) {
  if (s.owner !== 'D1_USERS' || !user || !/^[a-f0-9]{64}$/.test(transferActor))
    throw Error('Private owner required');
  const now = Date.now();
  await guardedBatch(
    s,
    [
      {
        sql: "EXISTS(SELECT 1 FROM app_users WHERE id=? AND status IN('ACTIVE','PENDING'))",
        values: [user],
      },
    ],
    [
      s.statement(
        "UPDATE app_users SET status='DELETED',primary_email=NULL,display_name=NULL,first_name=NULL,last_name=NULL,avatar_url=NULL,email_verified=0,updated_at=? WHERE id=?",
        [now, user],
      ),
      s.statement(
        "INSERT INTO app_account_erasure(user_id,transfer_actor,cursor,status,requested_at,updated_at) VALUES(?,?,0,'RUNNING',?,?)",
        [user, transferActor, now, now],
      ),
    ],
  );
  return { accepted: true, complete: false };
}
/** One bounded owner-only continuation. At most 25 explicit target rows, never
 * introspection. A CAS and deletion share a transaction; interruption is retryable.
 * Immutable payloads are reclaimed only in coordinated offline maintenance.
 * Uncertain transfers and unfinished commerce fail closed for operator review.
 */
export async function continueMultiD1Erasure(s: Storage) {
  if (s.owner !== 'D1_USERS') throw Error('Private owner required');
  const [job] = await s.rows<{ user_id: string; cursor: number }>(
    "SELECT user_id,cursor FROM app_account_erasure WHERE status='RUNNING' ORDER BY requested_at,user_id LIMIT 1",
  );
  if (!job) return { idle: true };
  const op = plan.operations[job.cursor];
  if (!op) {
    const [state] = await s.rows<{ status: string }>(
      `UPDATE app_account_erasure SET status=CASE WHEN
        EXISTS(SELECT 1 FROM app_commerce_orders WHERE user_id=?) OR
        EXISTS(SELECT 1 FROM app_commerce_refunds WHERE created_by_user_id=?) OR
        EXISTS(SELECT 1 FROM app_sportsbook_transfer_jobs WHERE actor=app_account_erasure.transfer_actor)
        THEN 'REVIEW_REQUIRED' ELSE 'AWAITING_GC' END,updated_at=?
       WHERE user_id=? AND cursor=? AND status='RUNNING' RETURNING status`,
      [job.user_id, job.user_id, Date.now(), job.user_id, job.cursor],
    );
    return {
      reviewRequired: state?.status === 'REVIEW_REQUIRED',
      awaitingGc: state?.status === 'AWAITING_GC',
    };
  }
  if (op.table === 'app_security_audit') await s.put({});
  const parameters: unknown[] = [];
  const sql = op.sql.replace(/:user/g, () => {
    parameters.push(job.user_id);
    return '?';
  });
  await guardedBatch(
    s,
    [
      {
        sql: "EXISTS(SELECT 1 FROM app_account_erasure e JOIN app_users u ON u.id=e.user_id WHERE e.user_id=? AND e.cursor=? AND e.status='RUNNING' AND u.status='DELETED')",
        values: [job.user_id, job.cursor],
      },
    ],
    [
      s.statement(sql, parameters),
      // changes() refers to the bounded cleanup statement, before the cursor update.
      s.statement(
        'UPDATE app_account_erasure SET cursor=cursor+CASE WHEN changes()=0 THEN 1 ELSE 0 END,updated_at=? WHERE user_id=? AND cursor=?',
        [Date.now(), job.user_id, job.cursor],
      ),
    ],
  );
  return { idle: false, phase: job.cursor, table: op.table };
}
