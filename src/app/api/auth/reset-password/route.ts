import { firebaseSelected } from '@/server/auth/firebase-config';
import { passwordRuntimeAvailable } from '@/server/persistence/bindings';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { resetPassword } from '@/server/auth/service';
export async function POST(request: NextRequest) {
  if (firebaseSelected()) return new Response(null, { status: 404 });
  if (!passwordRuntimeAvailable())
    return authError('Email password authentication is temporarily unavailable.', 503);
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
