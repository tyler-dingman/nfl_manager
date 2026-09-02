import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { unfollowTeam } from '@/server/user/repository';
import { teamIdSchema } from '@/server/user/validation';
export async function DELETE(r: NextRequest, { params }: { params: { teamId: string } }) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    await unfollowTeam(u.id, teamIdSchema.parse(params.teamId));
    return NextResponse.json({ ok: true });
  } catch {
    return authError('Unable to unfollow that team.');
  }
}
