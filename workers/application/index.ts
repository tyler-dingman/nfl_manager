import { Storage, type SqlDatabase } from '../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../packages/storage/objects';
import { MailQueue, ResendEmailProvider } from '../../packages/storage/mail';
import { scheduledApplicationOdds } from './odds';
import { ODDS_REFRESH_CRON } from '../../packages/parlay/freshness';
interface Env {
  APP_DB: SqlDatabase;
  APP_OBJECTS: Bucket;
  APP_BACKUP: Bucket;
  APP_ODDS_ENABLED?: string;
  SPORTSGAMEODDS_API_KEY?: string;
  APP_MAIL_ENABLED?: string;
  APP_MAIL_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  APP_MAIL_FROM?: string;
}
export default {
  fetch() {
    return new Response('No public application scheduler API', { status: 404 });
  },
  async scheduled(event: { cron: string; scheduledTime: number }, env: Env) {
    const s = new Storage(env.APP_DB, new PrivateObjects(env.APP_OBJECTS, env.APP_BACKUP));
    if (event.cron === ODDS_REFRESH_CRON) {
      if (env.APP_ODDS_ENABLED !== 'true') return;
      await scheduledApplicationOdds(
        s,
        new Date(event.scheduledTime),
        env.SPORTSGAMEODDS_API_KEY ?? '',
      );
    } else if (event.cron === '*/30 * * * *' && env.APP_MAIL_ENABLED === 'true') {
      if (!env.APP_MAIL_ENCRYPTION_KEY || !env.RESEND_API_KEY || !env.APP_MAIL_FROM)
        throw Error('Mail scheduled but not configured');
      const result = await new MailQueue(s, env.APP_MAIL_ENCRYPTION_KEY).process(
        new ResendEmailProvider(env.RESEND_API_KEY, env.APP_MAIL_FROM),
      );
      console.log(JSON.stringify({ metric: 'mail_queue', ...result }));
    }
  },
};
