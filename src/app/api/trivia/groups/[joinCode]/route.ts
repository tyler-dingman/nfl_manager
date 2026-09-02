import { NextRequest, NextResponse } from 'next/server';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getGroupRoom } from '@/server/trivia/social-repository';

export async function GET(request: NextRequest, { params }: { params: { joinCode: string } }) {
  try {
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json({ ok: true, room: await getGroupRoom(user.id, params.joinCode) });
  } catch (error) {
    return authError((error as Error).message, 404);
  }
}
