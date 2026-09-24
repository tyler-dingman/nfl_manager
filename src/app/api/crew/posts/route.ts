import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { crewPostSchema } from '@/features/crew/validation';
import { createCrewPost } from '@/server/crew/repository';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json(
      await createCrewPost(user.id, crewPostSchema.parse(await request.json())),
    );
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to post.');
  }
}
