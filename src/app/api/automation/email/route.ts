import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'node:crypto';
import {
  applicationBackend,
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
    const result = await new MailQueue(applicationStorage(), env.APP_MAIL_ENCRYPTION_KEY).process(
      new ResendEmailProvider(env.RESEND_API_KEY, env.APP_MAIL_FROM),
    );
    return NextResponse.json({ ok: true, ...result }, { status: result.deferred ? 207 : 200 });
  } catch {
    return NextResponse.json(
      { error: 'Email processing failed. Inspect durable queue state before retrying.' },
      { status: 503 },
    );
  }
}
