import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { confirmEmailChange } from '@/server/user/repository';
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const { token } = z.object({ token: z.string().min(20) }).parse(await r.json());
    await confirmEmailChange(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authError((e as Error).message);
  }
}
