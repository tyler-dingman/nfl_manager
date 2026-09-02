import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { requestEmailChange } from '@/server/user/repository';
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const { email } = z.object({ email: z.string().email().max(320) }).parse(await r.json());
    const token = await requestEmailChange(u.id, email);
    return NextResponse.json({
      ok: true,
      message: 'Check your new email to confirm the change.',
      ...(process.env.NODE_ENV === 'development' ? { verificationToken: token } : {}),
    });
  } catch {
    return authError('Unable to request that email change.');
  }
}
