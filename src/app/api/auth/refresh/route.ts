import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { requireAuthConfig } from '@/server/auth/config';
import { secureToken } from '@/server/auth/crypto';
import { authError, setSessionCookie, SESSION_COOKIE } from '@/server/auth/http';
import { rotateSession } from '@/server/auth/repository';
import { requestMetadata } from '@/server/auth/request';
const schema = z.object({
  refreshToken: z.string().min(20).optional(),
  mobile: z.boolean().optional(),
});
export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const oldToken = body.refreshToken ?? request.cookies.get(SESSION_COOKIE)?.value;
    if (!oldToken) return authError('Session is invalid.', 401);
    const newToken = secureToken(48);
    const rotated = await rotateSession(oldToken, newToken, requestMetadata(request));
    if (!rotated) return authError('Session is invalid.', 401);
    const accessToken = await new SignJWT({ sid: rotated.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(rotated.userId)
      .setIssuer('down-distance')
      .setAudience('down-distance-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(requireAuthConfig().AUTH_JWT_SECRET));
    const response = NextResponse.json({
      ok: true,
      accessToken,
      ...(body.mobile ? { refreshToken: newToken } : {}),
    });
    if (!body.mobile) setSessionCookie(response, newToken, rotated.expiresAt);
    return response;
  } catch {
    return authError('Session is invalid.', 401);
  }
}
