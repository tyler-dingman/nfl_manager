import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { confirmEmail } from '@/server/auth/service';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { token } = z.object({ token: z.string().min(20) }).parse(await request.json());
    await confirmEmail(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError((error as Error).message);
  }
}
