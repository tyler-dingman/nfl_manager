import { EditorialDatabase, integer, json, text } from './database';
import { teamId } from './teams';
import type { JobInput, JobRow } from './types';
export class EditorialJobs {
  constructor(readonly db: EditorialDatabase) {}
  async enqueue(job: JobInput) {
    [job.id, job.jobType, job.idempotencyKey].forEach(text);
    integer(job.availableAt);
    integer(job.ownerEpoch);
    if (job.teamId !== undefined) teamId(job.teamId);
    const max = job.maxAttempts ?? 5;
    if (!Number.isInteger(max) || max < 1 || max > 10) throw Error('Invalid attempt budget');
    const token = crypto.randomUUID();
    await this.db.batch('job.enqueue', [
      this.db.statement(
        "INSERT INTO transaction_assertions(token,value) VALUES(?,CASE WHEN ?=(SELECT version FROM content_control WHERE key='writer_epoch') THEN 1 ELSE 0 END)",
        [token, job.ownerEpoch],
      ),
      this.db.statement(
        `INSERT INTO ingestion_jobs(id,job_type,idempotency_key,status,source_id,candidate_id,team_id,available_at,max_attempts,owner_epoch,payload_json,created_at,updated_at) SELECT ?,?,?,'PENDING',?,?,?,?,?,?,?,?,? WHERE ?=(SELECT version FROM content_control WHERE key='writer_epoch') ON CONFLICT(idempotency_key) DO NOTHING`,
        [
          job.id,
          job.jobType,
          job.idempotencyKey,
          job.sourceId ?? null,
          job.candidateId ?? null,
          job.teamId ?? null,
          job.availableAt,
          max,
          job.ownerEpoch,
          json(job.payload),
          job.availableAt,
          job.availableAt,
          job.ownerEpoch,
        ],
      ),
      this.db.unguard(token),
    ]);
  }
  async claim(now: number, leaseMs: number, ownerEpoch = 1): Promise<JobRow | null> {
    integer(now);
    integer(leaseMs);
    integer(ownerEpoch);
    if (leaseMs < 1 || leaseMs > 300000) throw Error('Lease must be 1–300000 ms');
    const token = crypto.randomUUID();
    const results = await this.db.batch('job.claim', [
      this.db.statement(
        `UPDATE ingestion_jobs INDEXED BY jobs_exhausted SET status='DEAD',lease_token=NULL,lease_until=NULL,last_error_code='ATTEMPTS_EXHAUSTED',updated_at=? WHERE owner_epoch=? AND status IN ('PENDING','RUNNING') AND owner_epoch=(SELECT version FROM content_control WHERE key='writer_epoch') AND attempts>=max_attempts AND ((status='PENDING' AND available_at<=?) OR(status='RUNNING' AND lease_until<=?))`,
        [now, ownerEpoch, now, now],
      ),
      this.db.statement(
        `UPDATE ingestion_jobs SET status='RUNNING',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=(SELECT id FROM (SELECT id,due FROM (SELECT id,available_at AS due FROM ingestion_jobs WHERE owner_epoch=? AND status='PENDING' AND available_at<=? AND attempts<max_attempts ORDER BY available_at,id LIMIT 1) UNION ALL SELECT id,due FROM (SELECT id,lease_until AS due FROM ingestion_jobs WHERE owner_epoch=? AND status='RUNNING' AND lease_until<=? AND attempts<max_attempts ORDER BY lease_until,id LIMIT 1)) ORDER BY due,id LIMIT 1) AND owner_epoch=(SELECT version FROM content_control WHERE key='writer_epoch') RETURNING *`,
        [token, now + leaseMs, now, ownerEpoch, now, ownerEpoch, now],
      ),
    ]);
    return (results[1].results[0] as unknown as JobRow) ?? null;
  }
  async complete(job: JobRow, now: number) {
    integer(now);
    const token = crypto.randomUUID();
    await this.db.batch('job.complete', [
      this.db.statement(
        `UPDATE ingestion_jobs SET status='DONE',lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND status='RUNNING' AND lease_token=? AND lease_until>? AND owner_epoch=? AND owner_epoch=(SELECT version FROM content_control WHERE key='writer_epoch')`,
        [now, job.id, job.lease_token, now, job.owner_epoch],
      ),
      this.db.guard(token),
      this.db.unguard(token),
    ]);
  }
  async fail(job: JobRow, now: number, retryAt: number, errorCode: string) {
    integer(now);
    integer(retryAt);
    if (retryAt < now) throw Error('Retry cannot precede failure');
    text(errorCode);
    const token = crypto.randomUUID();
    await this.db.batch('job.fail', [
      this.db.statement(
        `UPDATE ingestion_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'DEAD' ELSE 'PENDING' END,lease_token=NULL,lease_until=NULL,last_error_code=?,available_at=?,updated_at=? WHERE id=? AND status='RUNNING' AND lease_token=? AND lease_until>? AND owner_epoch=? AND owner_epoch=(SELECT version FROM content_control WHERE key='writer_epoch')`,
        [errorCode, retryAt, now, job.id, job.lease_token, now, job.owner_epoch],
      ),
      this.db.guard(token),
      this.db.unguard(token),
    ]);
  }
}
