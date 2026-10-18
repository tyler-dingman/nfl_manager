import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { inviteUserToGroup } from '@/server/trivia/social-repository';

export async function POST(request: NextRequest, { params: asyncparams }: { params: Promise<{ joinCode: string }> }) {
const params = await asyncparams;

  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(await request.json());
    return NextResponse.json({
      ok: true,
      ...(await inviteUserToGroup(user.id, params.joinCode, userId)),
    });
  } catch (error) {
    return authError((error as Error).message);
  }
}
