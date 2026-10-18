import { offloadSavedMetadata } from '../../packages/storage/saved-metadata';
import { fanoutBriefingMail } from './briefing-mail';
import { Storage, type SqlDatabase } from '../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../packages/storage/objects';
import { MailQueue, ResendEmailProvider } from '../../packages/storage/mail';
import { maintainTemporaryData } from '../../packages/storage/lifecycle';
import { scheduledApplicationOdds } from './odds';
import { ODDS_REFRESH_CRON } from '../../packages/parlay/freshness';
interface Env {
  APP_DB: SqlDatabase;
  APP_OBJECTS: Bucket;
  APP_BACKUP: Bucket;
  APP_ODDS_ENABLED?: string;
  APP_ODDS_PROCESSING_ENABLED?: string;
  SPORTSGAMEODDS_API_KEY?: string;
  APP_MAIL_ENABLED?: string;
  APP_MAINTENANCE_ENABLED?: string;
  APP_MAIL_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  APP_MAIL_FROM?: string;
  AUTH_BASE_URL?: string;
  ODDS_PROCESSOR?: { fetch(request: Request): Promise<Response> };
}
export default {
  fetch() {
    return new Response('No public application scheduler API', { status: 404 });
  },
  async scheduled(event: { cron: string; scheduledTime: number }, env: Env) {
    const s = new Storage(env.APP_DB, new PrivateObjects(env.APP_OBJECTS, env.APP_BACKUP));
    const tick = new Date(event.scheduledTime);
    if (
      env.APP_MAINTENANCE_ENABLED === 'true' &&
      event.cron === '*/30 * * * *' &&
      tick.getUTCHours() === 0 &&
      tick.getUTCMinutes() === 0
    ) {
      await maintainTemporaryData(s, event.scheduledTime, 12);
      await offloadSavedMetadata(s, 3);
      return;
    }
    if (event.cron === ODDS_REFRESH_CRON) {
      if (env.APP_ODDS_ENABLED !== 'true') return;
      await scheduledApplicationOdds(
        s,
        new Date(event.scheduledTime),
        env.SPORTSGAMEODDS_API_KEY ?? '',
      );
      if (env.APP_ODDS_PROCESSING_ENABLED === 'true' && env.ODDS_PROCESSOR)
        for (let i = 0; i < 25; i++) {
          const response = await env.ODDS_PROCESSOR.fetch(
            new Request('https://internal/process', { method: 'POST' }),
          );
          if (!response.ok) throw Error('Odds processing invocation failed');
          const result = (await response.json()) as { status: string };
          if (result.status === 'idle') break;
        }
    } else if (event.cron === '*/30 * * * *' && env.APP_MAIL_ENABLED === 'true') {
      if (!env.APP_MAIL_ENCRYPTION_KEY || !env.RESEND_API_KEY || !env.APP_MAIL_FROM)
        throw Error('Mail scheduled but not configured');
      if (!env.AUTH_BASE_URL) throw Error('Mail public base URL is not configured');
      await fanoutBriefingMail(
        s,
        env.APP_MAIL_ENCRYPTION_KEY,
        env.AUTH_BASE_URL,
        event.scheduledTime,
      );
      const result = await new MailQueue(s, env.APP_MAIL_ENCRYPTION_KEY).process(
        new ResendEmailProvider(env.RESEND_API_KEY, env.APP_MAIL_FROM),
      );
      console.log(JSON.stringify({ metric: 'mail_queue', ...result }));
    }
  },
};
