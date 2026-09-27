import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, clearSessionCookie, SESSION_COOKIE } from '@/server/auth/http';
import { revokeSessionToken } from '@/server/auth/repository';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { deleteWebSubscription } from '@/server/notifications/web-push-repository';
export async function POST(request: NextRequest) {
  try {
    const body = z
      .object({ refreshToken: z.string().min(20).optional() })
      .parse(await request.json().catch(() => ({})));
    if (!body.refreshToken) assertSameOrigin(request);
    const token = body.refreshToken ?? request.cookies.get(SESSION_COOKIE)?.value;
    if (!body.refreshToken) {
      const hash = request.cookies.get('dd_web_push')?.value;
      if (hash) {
        const user = await currentUser(request);
        if (user) await deleteWebSubscription(user.id, hash).catch(() => undefined);
      }
    }
    if (token) await revokeSessionToken(token);
  } catch {
    /* Always clear the browser cookie. */
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  response.cookies.delete('dd_web_push');
  return response;
}
