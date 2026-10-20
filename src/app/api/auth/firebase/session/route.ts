import { authStage } from '@/server/auth/performance';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError, SESSION_COOKIE, setSessionCookie } from '@/server/auth/http';
import { exchangeFirebaseSession } from '@/server/auth/firebase-service';
import { requestMetadata } from '@/server/auth/request';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { firebaseSelected } from '@/server/auth/firebase-config';
const schema = z.object({
  idToken: z.string().min(1).max(16384),
  mobile: z.boolean().optional(),
  refreshToken: z.string().max(256).optional(),
  deviceId: z.string().uuid().optional(),
});
export async function POST(request: NextRequest) {
  if (!firebaseSelected()) return authError('Not found.', 404);
  try {
    assertSameOrigin(request);
    const metadata = requestMetadata(request);
    if (!checkRateLimit(`firebase-session:${metadata.ip ?? 'unknown'}`, 60, 60000))
      return authError('Please try again later.', 429);
    const input = schema.parse(await authStage('request.parse', () => request.json()));
    const session = await exchangeFirebaseSession(
      input.idToken,
      input.mobile ? input.refreshToken : request.cookies.get(SESSION_COOKIE)?.value,
      { ...metadata, deviceId: input.deviceId, mobile: input.mobile === true },
    );
    const response = await authStage('json.serialization', () =>
      NextResponse.json({
        ok: true,
        user: session.user,
        ...(input.mobile
          ? { accessToken: session.accessToken, refreshToken: session.refreshToken }
          : {}),
      }),
    );
    if (!input.mobile) setSessionCookie(response, session.refreshToken, session.expiresAt);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return authError(
      'Unable to authenticate. Sign in again or contact the owner if this test email already exists.',
      401,
    );
  }
}
