import { NextRequest, NextResponse } from 'next/server';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getGroupRoomByToken, joinGroupByToken } from '@/server/trivia/social-repository';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const user = await currentUser(request);
    if (!user) return authError('Sign in to join this Trivia game.', 401);
    return NextResponse.json({ room: await getGroupRoomByToken(user.id, params.token) });
  } catch (error) {
    return authError((error as Error).message, 404);
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Sign in to join this Trivia game.', 401);
    const result = await joinGroupByToken(user.id, params.token);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return authError((error as Error).message);
  }
}
