import { fanoutBriefingMail } from '../../../../../workers/application/briefing-mail';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'node:crypto';
import {
  applicationBackend,
  applicationDatabaseRouter,
  applicationEnvironment,
  applicationStorage,
} from '@/server/persistence/bindings';
import { MailQueue, ResendEmailProvider } from '../../../../../packages/storage/mail';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const env = applicationEnvironment(),
    expected = env.APP_MAIL_JOB_SECRET;
  if (
    !expected ||
    expected.length < 32 ||
    !timingSafeEqual(
      createHash('sha256')
        .update(request.headers.get('authorization') ?? '')
        .digest(),
      createHash('sha256').update(`Bearer ${expected}`).digest(),
    )
  )
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (
    applicationBackend() !== 'd1' ||
    env.APP_MAIL_ENABLED !== 'true' ||
    !env.APP_MAIL_ENCRYPTION_KEY ||
    !env.RESEND_API_KEY ||
    !env.APP_MAIL_FROM
  )
    return NextResponse.json(
      { error: 'Email delivery is disabled or unconfigured.' },
      { status: 503 },
    );
  try {
    const action = request.nextUrl.searchParams.get('action') ?? 'process';
    if (!['process', 'fanout'].includes(action))
      return NextResponse.json({ ok: false, error: 'Unknown mail continuation' }, { status: 400 });
    if (action === 'fanout') {
      if (!env.AUTH_BASE_URL)
        return NextResponse.json({ ok: false, error: 'Mail base URL missing' }, { status: 503 });
      return NextResponse.json({
        ok: true,
        ...(await fanoutBriefingMail(
          applicationStorage('D1_USERS'),
          env.APP_MAIL_ENCRYPTION_KEY,
          env.AUTH_BASE_URL,
          Date.now(),
          1,
        )),
      });
    }
    const result = await new MailQueue(
      applicationStorage('D1_USERS'),
      env.APP_MAIL_ENCRYPTION_KEY,
    ).process(
      new ResendEmailProvider(env.RESEND_API_KEY, env.APP_MAIL_FROM),
      Date.now(),
      applicationDatabaseRouter() ? 1 : 3,
    );
    return NextResponse.json({ ok: true, ...result }, { status: result.deferred ? 207 : 200 });
  } catch {
    return NextResponse.json(
      { error: 'Email processing failed. Inspect durable queue state before retrying.' },
      { status: 503 },
    );
  }
}
