import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { acceptFriend, removeFriend } from '@/server/trivia/social-repository';
export async function PATCH(r: NextRequest, { params: asyncparams }: { params: Promise<{ userId: string }> }) {
const params = await asyncparams;

  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({ ok: true, friends: await acceptFriend(u.id, params.userId) });
  } catch (e) {
    return authError((e as Error).message);
  }
}
export async function DELETE(r: NextRequest, { params: asyncparams }: { params: Promise<{ userId: string }> }) {
const params = await asyncparams;

  assertSameOrigin(r);
  const u = await currentUser(r);
  if (!u) return authError('Unauthorized.', 401);
  await removeFriend(u.id, params.userId);
  return NextResponse.json({ ok: true });
}
