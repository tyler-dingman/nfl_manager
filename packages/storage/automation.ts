import { Storage } from './core';
export class D1ContentAutomation {
  constructor(
    readonly s: Storage,
    readonly compactDailyCounter = false,
  ) {}
  async readTrialUsage(starts: Date, expires: Date) {
    const [r] = await this.s.rows<any>(
      'SELECT coalesce(sum(generated_items),0) AS generatedTotal,coalesce(sum(CASE WHEN started_at>=? THEN generated_items ELSE 0 END),0) AS generatedToday,coalesce(sum(ai_spend_usd),0) AS aiSpendTotalUsd FROM app_content_automation_runs WHERE trial_starts_at=? AND trial_expires_at=?',
      [new Date().setUTCHours(0, 0, 0, 0), starts.getTime(), expires.getTime()],
    );
    return r as { generatedTotal: number; generatedToday: number; aiSpendTotalUsd: number };
  }
  async readGlobalGeneratedToday() {
    if (this.compactDailyCounter) {
      const [row] = await this.s.rows<{ generated: number }>(
        'SELECT generated FROM app_content_automation_totals WHERE day=?',
        [Math.floor(Date.now() / 86400000)],
      );
      return row?.generated ?? 0;
    }
    const [r] = await this.s.rows<any>(
      'SELECT coalesce(sum(generated_items),0) AS n FROM app_content_automation_runs WHERE trial_starts_at IS NULL AND started_at>=?',
      [new Date().setUTCHours(0, 0, 0, 0)],
    );
    return r.n as number;
  }
  async record(input: {
    startsAt?: Date;
    expiresAt?: Date;
    pollingGroup?: string;
    status: string;
    sourcesDue?: number;
    sourcesQueued?: number;
    jobsProcessed?: number;
    generatedItems?: number;
    failedJobs?: number;
    aiSpendUsd?: number;
    detail?: object;
  }) {
    const hash = await this.s.put({ schema: 1, detail: input.detail ?? {} }),
      now = Date.now();
    await this.s
      .statement(
        'INSERT INTO app_content_automation_runs(id,trial_starts_at,trial_expires_at,polling_group,status,sources_due,sources_queued,jobs_processed,generated_items,failed_jobs,ai_spend_usd,object_hash,started_at,finished_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          crypto.randomUUID(),
          input.startsAt?.getTime() ?? null,
          input.expiresAt?.getTime() ?? null,
          input.pollingGroup ?? null,
          input.status,
          input.sourcesDue ?? 0,
          input.sourcesQueued ?? 0,
          input.jobsProcessed ?? 0,
          input.generatedItems ?? 0,
          input.failedJobs ?? 0,
          input.aiSpendUsd ?? 0,
          hash,
          now,
          now,
        ],
      )
      .run();
  }
  recordTrialRun(input: Parameters<D1ContentAutomation['record']>[0]) {
    return this.record(input);
  }
  recordGlobalRun(input: Parameters<D1ContentAutomation['record']>[0]) {
    return this.record(input);
  }
}
