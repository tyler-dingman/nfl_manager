import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError } from '@/server/auth/http';
import { getAuthProvider } from '@/server/auth/providers';
import { resolveSocialUser, toPublicUser } from '@/server/auth/repository';
import { requestMetadata } from '@/server/auth/request';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { issueSession } from '@/server/auth/service';
import { requiresPkce } from '@/server/auth/pkce';
const schema = z.object({
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  authorizationCode: z.string().optional(),
  nonce: z.string().min(16).optional(),
  codeVerifier: z.string().min(43).max(128).optional(),
  redirectUri: z.string().url(),
  user: z.string().max(4000).optional(),
  deviceId: z.string().uuid().optional(),
}).refine((input) => requiresPkce(input.authorizationCode, input.codeVerifier), {
  message: 'codeVerifier is required when exchanging an authorization code.',
});
export async function POST(request: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const ip = requestMetadata(request).ip ?? 'unknown';
    if (!checkRateLimit(`social-exchange:${params.provider}:${ip}`, 20, 15 * 60_000))
      return authError('Please try again later.', 429);
    const input = schema.parse(await request.json());
    const provider = getAuthProvider(params.provider);
    const identity = await provider.validateCallback({
      code: input.authorizationCode,
      idToken: input.idToken,
      accessToken: input.accessToken,
      nonce: input.nonce,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri,
      user: input.user,
    });
    const user = toPublicUser(await resolveSocialUser(identity));
    const session = await issueSession(user.id, {
      ...requestMetadata(request),
      deviceId: input.deviceId,
    });
    return NextResponse.json({
      ok: true,
      user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    });
  } catch {
    return authError('Provider credential is invalid.', 401);
  }
}
