import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { registerTriviaEvent } from '@/server/trivia/event-repository';
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Sign in to register.', 401);
    const id = z.string().uuid().parse(params.eventId);
    const { action } = z
      .object({ action: z.enum(['register', 'join']) })
      .parse(await request.json());
    return NextResponse.json({
      ok: true,
      ...(await registerTriviaEvent(id, user.id, action === 'join')),
    });
  } catch (error) {
    return authError((error as Error).message);
  }
}
