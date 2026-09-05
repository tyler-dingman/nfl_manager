import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';

export async function readTrialUsage(startsAt: Date, expiresAt: Date) {
  const [row] = await authDb()`SELECT
    COALESCE(SUM(generated_items),0)::int AS generated_total,
    COALESCE(SUM(generated_items) FILTER (WHERE started_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS generated_today,
    COALESCE(SUM(ai_spend_usd),0)::numeric AS ai_spend_total
    FROM content_automation_trial_runs WHERE trial_starts_at=${startsAt} AND trial_expires_at=${expiresAt}`;
  return {
    generatedTotal: Number(row?.generated_total ?? 0),
    generatedToday: Number(row?.generated_today ?? 0),
    aiSpendTotalUsd: Number(row?.ai_spend_total ?? 0),
  };
}

export async function recordTrialRun(input: {
  startsAt: Date;
  expiresAt: Date;
  pollingGroup: 'standard' | 'video';
  status: string;
  generatedItems?: number;
  aiSpendUsd?: number;
  detail?: object;
}) {
  await authDb()`INSERT INTO content_automation_trial_runs
    (id,trial_starts_at,trial_expires_at,polling_group,status,generated_items,ai_spend_usd,detail,finished_at)
    VALUES(${randomUUID()},${input.startsAt},${input.expiresAt},${input.pollingGroup},${input.status},${input.generatedItems ?? 0},${input.aiSpendUsd ?? 0},${authDb().json((input.detail ?? {}) as any)},now())`;
}
