import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { unfollowTeam } from '@/server/user/repository';
import { teamIdSchema } from '@/server/user/validation';
export async function DELETE(r: NextRequest, { params: asyncparams }: { params: Promise<{ teamId: string }> }) {
const params = await asyncparams;

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
