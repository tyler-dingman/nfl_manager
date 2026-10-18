import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { reactToActivity } from '@/server/crew/repository';
export async function POST(request: NextRequest, { params: asyncparams }: { params: Promise<{ activityId: string }> }) {
const params = await asyncparams;

  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const { reaction } = z
      .object({ reaction: z.enum(['FIRE', 'LAUGH', 'EYES', 'LIKE']) })
      .parse(await request.json());
    await reactToActivity(user.id, params.activityId, reaction);
    return NextResponse.json({ ok: true });
  } catch {
    return authError('Unable to react.');
  }
}
