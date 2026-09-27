import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { tokenHash } from '@/server/auth/crypto';
import { vapidConfig, webSubscriptionSchema } from '@/server/notifications/web-push';
import {
  deleteWebSubscription,
  saveWebSubscription,
} from '@/server/notifications/web-push-repository';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  if (!(await currentUser(request))) return authError('Unauthorized.', 401);
  return NextResponse.json(
    { publicKey: vapidConfig()?.publicKey ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    if (!vapidConfig()) return authError('Browser notifications are not configured yet.', 503);
    const input = webSubscriptionSchema.safeParse(await request.json());
    if (!input.success) return authError('Invalid browser subscription.', 400);
    const token = await saveWebSubscription(user.id, input.data);
    const response = NextResponse.json({ tokenId: token.id });
    response.cookies.set('dd_web_push', tokenHash(input.data.endpoint), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return authError('Unable to save browser subscription.', 400);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const hash = request.cookies.get('dd_web_push')?.value;
    if (hash) await deleteWebSubscription(user.id, hash);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('dd_web_push');
    return response;
  } catch {
    return authError('Unable to remove browser subscription.', 400);
  }
}
