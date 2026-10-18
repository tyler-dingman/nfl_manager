import { Storage } from '../../packages/storage/core';
import { MailQueue } from '../../packages/storage/mail';
export async function fanoutBriefingMail(
  s: Storage,
  secret: string,
  baseUrl: string,
  now = Date.now(),
) {
  const [job] = await s.rows<any>(
    "SELECT * FROM app_briefing_mail_jobs WHERE status='READY' OR (status='RUNNING' AND lease_until<?) ORDER BY id LIMIT 1",
    [now],
  );
  if (!job) return { status: 'idle' };
  const nonce = crypto.randomUUID(),
    claimed = await s
      .statement(
        "UPDATE app_briefing_mail_jobs SET status='RUNNING',lease_nonce=?,lease_until=? WHERE id=? AND (status='READY' OR (status='RUNNING' AND lease_until<?)) RETURNING id",
        [nonce, now + 300000, job.id, now],
      )
      .first();
  if (!claimed) return { status: 'busy' };
  const result = await new MailQueue(s, secret).enqueueDailyBriefing(
    job.object_hash,
    baseUrl,
    job.after_user,
  );
  await s
    .statement(
      'UPDATE app_briefing_mail_jobs SET after_user=?,status=?,lease_until=0 WHERE id=? AND lease_nonce=?',
      [result.nextCursor ?? job.after_user, result.nextCursor ? 'READY' : 'DONE', job.id, nonce],
    )
    .run();
  return { status: 'queued', ...result };
}
