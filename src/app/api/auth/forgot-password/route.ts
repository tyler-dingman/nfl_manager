import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { requestMetadata } from '@/server/auth/request';
import { requestPasswordReset } from '@/server/auth/service';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ip = requestMetadata(request).ip ?? 'unknown';
    if (!checkRateLimit(`reset:${ip}`, 5, 60 * 60_000))
      return authError('Please try again later.', 429);
    const { email } = z.object({ email: z.string().email() }).parse(await request.json());
    const result = await requestPasswordReset(email);
    return NextResponse.json({
      ok: true,
      message: 'If an account exists, a reset link will be sent.',
      ...result,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      message: 'If an account exists, a reset link will be sent.',
    });
  }
}
