import { NextRequest, NextResponse } from 'next/server';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createGroupRematch } from '@/server/trivia/social-repository';

export async function POST(request: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Sign in to run it back.', 401);
    return NextResponse.json({
      ok: true,
      ...(await createGroupRematch(user.id, params.gameId)),
    });
  } catch (error) {
    return authError((error as Error).message);
  }
}
