import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createGroup } from '@/server/trivia/social-repository';
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const i = z
      .object({
        teamId: z
          .string()
          .min(2)
          .max(8)
          .transform((v) => v.toUpperCase()),
      })
      .parse(await r.json());
    return NextResponse.json({ ok: true, ...(await createGroup(u.id, i.teamId)) }, { status: 201 });
  } catch (e) {
    return authError((e as Error).message);
  }
}
