import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { followTeam, listTeamFollows } from '@/server/user/repository';
import { teamIdSchema } from '@/server/user/validation';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  return u
    ? NextResponse.json({ ok: true, follows: await listTeamFollows(u.id) })
    : authError('Unauthorized.', 401);
}
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const i = z
      .object({
        teamId: teamIdSchema,
        notificationLevel: z.enum(['OFF', 'MAJOR', 'DEFAULT', 'ALL']).optional(),
      })
      .parse(await r.json());
    return NextResponse.json({
      ok: true,
      follows: await followTeam(u.id, i.teamId, i.notificationLevel),
    });
  } catch {
    return authError('Unable to follow that team.');
  }
}
