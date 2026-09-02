import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { setPrimaryTeam } from '@/server/user/repository';
import { teamIdSchema } from '@/server/user/validation';
export async function PUT(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const { teamId } = z.object({ teamId: teamIdSchema }).parse(await r.json());
    return NextResponse.json({ ok: true, follows: await setPrimaryTeam(u.id, teamId) });
  } catch {
    return authError('Unable to change primary team.');
  }
}
