import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError, setSessionCookie } from '@/server/auth/http';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { requestMetadata } from '@/server/auth/request';
import { issueSession, loginWithEmail } from '@/server/auth/service';
import { getOnboarding } from '@/server/user/repository';
import { logSecurityEvent } from '@/server/security/log';
import { recordSecurityEvent } from '@/server/security/audit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
  mobile: z.boolean().optional(),
  deviceId: z.string().uuid().optional(),
});
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const metadata = requestMetadata(request);
    if (!checkRateLimit(`login:${metadata.ip ?? 'unknown'}`, 20, 15 * 60_000))
      return authError('Please try again later.', 429);
    const input = schema.parse(await request.json());
    const user = await loginWithEmail(input.email, input.password);
    logSecurityEvent('SIGN_IN', { userId: user.id, ip: metadata.ip });
    void recordSecurityEvent(user.id, 'SIGN_IN', metadata).catch(() => undefined);
    const session = await issueSession(user.id, { ...metadata, deviceId: input.deviceId });
    const response = NextResponse.json({
      ok: true,
      user,
      onboarding: await getOnboarding(user.id),
      ...(input.mobile
        ? { accessToken: session.accessToken, refreshToken: session.refreshToken }
        : {}),
    });
    if (!input.mobile) setSessionCookie(response, session.refreshToken, session.expiresAt);
    return response;
  } catch {
    logSecurityEvent('SIGN_IN_FAILED', { ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null });
    return authError('The email or password is incorrect.', 401);
  }
}
