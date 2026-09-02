import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { getRoom } from '@/server/game-day/repository';
export async function GET(r: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({ room: await getRoom(u.id, params.roomId) });
  } catch (e) {
    return authError((e as Error).message, 404);
  }
}
