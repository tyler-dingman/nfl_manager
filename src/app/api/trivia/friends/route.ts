import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listFriends, requestFriend, searchUsers } from '@/server/trivia/social-repository';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  if (!u) return authError('Unauthorized.', 401);
  const q = r.nextUrl.searchParams.get('query');
  return NextResponse.json({
    ok: true,
    [q ? 'users' : 'friends']: q ? await searchUsers(u.id, q) : await listFriends(u.id),
  });
}
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(await r.json());
    return NextResponse.json({ ok: true, friends: await requestFriend(u.id, userId) });
  } catch (e) {
    return authError((e as Error).message);
  }
}
