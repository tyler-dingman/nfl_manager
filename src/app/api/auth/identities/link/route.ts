import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError, safeRedirect } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return authError('Invalid request origin.', 403);
  }
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    const { provider, next } = z
      .object({ provider: z.enum(['apple', 'google', 'facebook']), next: z.string().optional() })
      .parse(await request.json());
    return NextResponse.json({
      ok: true,
      url: `/api/auth/social/${provider}/start?link=1&next=${encodeURIComponent(safeRedirect(next, '/account/security'))}`,
    });
  } catch {
    return authError('Unsupported sign-in provider.');
  }
}
