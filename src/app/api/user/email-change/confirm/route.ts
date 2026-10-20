import { firebaseSelected } from '@/server/auth/firebase-config';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { confirmEmailChange } from '@/server/user/repository';
export async function POST(r: NextRequest) {
  if (firebaseSelected())
    return new Response(
      JSON.stringify({
        error:
          'Email changes require the identity provider and are not enabled in this staging integration.',
      }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    );
  try {
    assertSameOrigin(r);
    const { token } = z.object({ token: z.string().min(20) }).parse(await r.json());
    await confirmEmailChange(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authError((e as Error).message);
  }
}
