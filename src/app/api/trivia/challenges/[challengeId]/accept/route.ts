import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { acceptChallenge } from '@/server/trivia/social-repository';
export async function POST(r: NextRequest, { params }: { params: { challengeId: string } }) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({ ok: true, ...(await acceptChallenge(u.id, params.challengeId)) });
  } catch (e) {
    return authError((e as Error).message);
  }
}
