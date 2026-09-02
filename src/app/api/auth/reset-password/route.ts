import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { resetPassword } from '@/server/auth/service';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = z
      .object({ token: z.string().min(20), password: z.string().min(10).max(256) })
      .parse(await request.json());
    await resetPassword(input.token, input.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError((error as Error).message);
  }
}
