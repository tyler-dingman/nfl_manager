import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, safeRedirect } from '@/server/auth/http';
import { checkRateLimit } from '@/server/auth/rate-limit';
import {
  issuePreviewToken,
  prelaunchEnabled,
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE_SECONDS,
} from '@/lib/prelaunch';

const schema = z.object({
  password: z.string().min(1).max(256),
  next: z.string().max(1000).optional(),
});

function passwordsMatch(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  try {
    if (!prelaunchEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
    assertSameOrigin(request);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkRateLimit(`preview:${ip}`, 10, 15 * 60_000))
      return NextResponse.json({ ok: false, error: 'Please try again later.' }, { status: 429 });
    const input = schema.parse(await request.json());
    const expected = process.env.PRELAUNCH_PASSWORD;
    if (!expected || !passwordsMatch(input.password, expected))
      return NextResponse.json({ ok: false, error: 'Incorrect password.' }, { status: 401 });
    const response = NextResponse.json({ ok: true, redirectTo: safeRedirect(input.next, '/') });
    response.cookies.set(PREVIEW_COOKIE, await issuePreviewToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: PREVIEW_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: 'Incorrect password.' }, { status: 401 });
  }
}
