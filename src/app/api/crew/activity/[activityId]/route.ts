import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { deleteCrewPost } from '@/server/crew/repository';
import { z } from 'zod';

export async function DELETE(request: NextRequest, { params }: { params: { activityId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    z.string().uuid().parse(params.activityId);
    await deleteCrewPost(user.id, params.activityId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to update Crew.');
  }
}
