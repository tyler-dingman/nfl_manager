import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { commentOnCrewActivity } from '@/server/crew/repository';
import { z } from 'zod';
import { crewCommentSchema } from '@/features/crew/validation';
export async function POST(request: NextRequest, { params }: { params: { activityId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    z.string().uuid().parse(params.activityId);
    await commentOnCrewActivity(
      user.id,
      params.activityId,
      crewCommentSchema.parse(await request.json()).message,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to update Crew.');
  }
}
