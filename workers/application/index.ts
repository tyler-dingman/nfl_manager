import { drainSocialNotifications } from '../../packages/storage/social-outbox';
import { offloadSavedMetadata } from '../../packages/storage/saved-metadata';
import { fanoutBriefingMail } from './briefing-mail';
import { Storage, type SqlDatabase } from '../../packages/storage/core';
import { type Bucket } from '../../packages/storage/objects';
import { applicationObjects } from '../../packages/storage/d1-objects';
import { MailQueue, ResendEmailProvider } from '../../packages/storage/mail';
import { maintainTemporaryData } from '../../packages/storage/lifecycle';
import { scheduledApplicationOdds } from './odds';
import { ODDS_REFRESH_CRON } from '../../packages/parlay/freshness';
interface Env {
  APP_DB: SqlDatabase;
  APP_OBJECT_BACKEND?: string;
  APP_OBJECTS?: Bucket;
  APP_BACKUP?: Bucket;
  APP_ODDS_ENABLED?: string;
  APP_ODDS_PROCESSING_ENABLED?: string;
  SPORTSGAMEODDS_API_KEY?: string;
  APP_MAIL_ENABLED?: string;
  APP_SOCIAL_NOTIFICATIONS_ENABLED?: string;
  APP_MAINTENANCE_ENABLED?: string;
  APP_CONTENT_ENABLED?: string;
  APP_BRIEFINGS_ENABLED?: string;
  CONTENT_AUTOMATION_SECRET?: string;
  API_SERVICE?: { fetch(request: Request): Promise<Response> };
  APP_MAIL_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  APP_MAIL_FROM?: string;
  AUTH_BASE_URL?: string;
  ODDS_PROCESSOR?: { fetch(request: Request): Promise<Response> };
}
export const applicationWorker = {
  fetch() {
    return new Response('No public application scheduler API', { status: 404 });
  },
  async scheduled(event: { cron: string; scheduledTime: number }, env: Env) {
    const s = new Storage(env.APP_DB, applicationObjects(env));
    const tick = new Date(event.scheduledTime);
    if (
      event.cron === '*/30 * * * *' &&
      (env.APP_CONTENT_ENABLED === 'true' || env.APP_BRIEFINGS_ENABLED === 'true')
    ) {
      if (!env.API_SERVICE || !env.CONTENT_AUTOMATION_SECRET)
        throw Error('Application jobs require an API binding and automation secret');
      const paths = [
        ...(env.APP_CONTENT_ENABLED === 'true' ? ['/api/automation/content/global'] : []),
        ...(env.APP_BRIEFINGS_ENABLED === 'true'
          ? [
              '/api/automation/three-and-out?action=generate',
              '/api/automation/three-and-out?action=deliver',
            ]
          : []),
      ];
      for (const path of paths) {
        const response = await env.API_SERVICE.fetch(
          new Request('https://application.internal' + path, {
            method: 'POST',
            headers: { authorization: 'Bearer ' + env.CONTENT_AUTOMATION_SECRET },
          }),
        );
        if (!response.ok)
          throw Error('Application scheduled job rejected: ' + path + ' (' + response.status + ')');
        const body = (await response.json()) as { ok?: boolean };
        if (body.ok === false) throw Error('Application scheduled job failed: ' + path);
      }
    }

    if (event.cron === '*/30 * * * *' && env.APP_SOCIAL_NOTIFICATIONS_ENABLED === 'true')
      await drainSocialNotifications(s, 3, event.scheduledTime);
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

export default applicationWorker;
