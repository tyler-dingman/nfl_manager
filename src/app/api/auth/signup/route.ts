import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError, setSessionCookie } from '@/server/auth/http';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { requestMetadata } from '@/server/auth/request';
import { issueSession, signupWithEmail } from '@/server/auth/service';
import { getOnboarding } from '@/server/user/repository';

const inputSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(256),
  displayName: z.string().trim().max(100).optional(),
});
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ip = requestMetadata(request).ip ?? 'unknown';
    if (!checkRateLimit(`signup:${ip}`, 10, 60 * 60_000))
      return authError('Please try again later.', 429);
    const input = inputSchema.parse(await request.json());
    const result = await signupWithEmail(input);
    const session = await issueSession(result.user.id, requestMetadata(request));
    const response = NextResponse.json(
      {
        ok: true,
        user: result.user,
        onboarding: await getOnboarding(result.user.id),
        verificationToken: result.verificationToken,
      },
      { status: 201 },
    );
    setSessionCookie(response, session.refreshToken, session.expiresAt);
    return response;
  } catch (error) {
    return authError(
      error instanceof z.ZodError
        ? 'Check your account details and try again.'
        : (error as Error).message,
    );
  }
}
