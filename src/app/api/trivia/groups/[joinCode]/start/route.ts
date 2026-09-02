import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { startGroup } from '@/server/trivia/social-repository';
export async function POST(r: NextRequest, { params }: { params: { joinCode: string } }) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({ ok: true, ...(await startGroup(u.id, params.joinCode)) });
  } catch (e) {
    return authError((e as Error).message);
  }
}
