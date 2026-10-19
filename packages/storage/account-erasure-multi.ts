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
 * Shared containers and legal/security records require explicit reviewed policies,
 * so this phase deliberately ends REVIEW_REQUIRED, never falsely reports erasure.
 */
export async function continueMultiD1Erasure(s: Storage) {
  if (s.owner !== 'D1_USERS') throw Error('Private owner required');
  const [job] = await s.rows<{ user_id: string; cursor: number }>(
    "SELECT user_id,cursor FROM app_account_erasure WHERE status='RUNNING' ORDER BY requested_at,user_id LIMIT 1",
  );
  if (!job) return { idle: true };
  const op = plan.operations[job.cursor];
  if (!op) {
    await s
      .statement(
        "UPDATE app_account_erasure SET status='REVIEW_REQUIRED',updated_at=? WHERE user_id=? AND cursor=? AND status='RUNNING'",
        [Date.now(), job.user_id, job.cursor],
      )
      .run();
    return { reviewRequired: true };
  }
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
