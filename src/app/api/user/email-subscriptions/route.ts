import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin, authError } from '@/server/auth/http';
import {
  applicationBackend,
  applicationStorage,
  applicationEnvironment,
} from '@/server/persistence/bindings';
import { MailQueue } from '../../../../../packages/storage/mail';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (applicationBackend() !== 'd1')
    return authError('This staged subscription service requires D1.', 503);
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const s = applicationStorage(),
    [subscription] = await s.rows<{ enabled: number }>(
      'SELECT enabled FROM app_subscriptions WHERE user_id=? AND topic=?',
      [user.id, 'THREE_AND_OUT'],
    );
  const queue = await s.rows(
    'SELECT status,count(*) AS count FROM app_mail WHERE user_id=? GROUP BY status',
    [user.id],
  );
  return NextResponse.json(
    {
      enabled: Boolean(subscription?.enabled),
      queue,
      delivery: 'Provider qualification and subscriber capacity required',
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (applicationBackend() !== 'd1')
      return authError('This staged subscription service requires D1.', 503);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const body = await request.json();
    if (typeof body.enabled !== 'boolean') return authError('enabled must be a boolean.');
    const secret = applicationEnvironment().APP_MAIL_ENCRYPTION_KEY;
    if (!secret) return authError('Mail is not configured.', 503);
    await new MailQueue(applicationStorage(), secret).subscribe(user.id, body.enabled);
    return NextResponse.json({ ok: true, enabled: body.enabled });
  } catch {
    return authError('Unable to update email preferences.');
  }
}
