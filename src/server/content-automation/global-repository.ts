import { randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';

export async function readGlobalGeneratedToday() {
  const [row] = await authDb()`SELECT COALESCE(SUM(generated_items),0)::int AS generated_today
    FROM content_automation_runs
    WHERE started_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;
  return Number(row?.generated_today ?? 0);
}

export async function recordGlobalRun(input: {
  status: string;
  sourcesDue?: number;
  sourcesQueued?: number;
  jobsProcessed?: number;
  generatedItems?: number;
  failedJobs?: number;
  detail?: object;
}) {
  await authDb()`INSERT INTO content_automation_runs
    (id,status,sources_due,sources_queued,jobs_processed,generated_items,failed_jobs,detail,finished_at)
    VALUES(
      ${randomUUID()},
      ${input.status},
      ${input.sourcesDue ?? 0},
      ${input.sourcesQueued ?? 0},
      ${input.jobsProcessed ?? 0},
      ${input.generatedItems ?? 0},
      ${input.failedJobs ?? 0},
      ${authDb().json((input.detail ?? {}) as any)},
      now()
    )`;
}
