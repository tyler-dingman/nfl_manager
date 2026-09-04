import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getCrewShareRecipients, shareToCrew } from '@/server/crew/repository';
const schema = z.object({
  contentId: z.string().min(1).max(128),
  contentType: z.enum(['BEAT_STORY', 'FILM_ROOM', 'GAME_DAY', 'TRIVIA', 'FRONT_OFFICE']),
  href: z.string().startsWith('/'),
  title: z.string().min(1).max(180),
  message: z.string().max(120).optional(),
  recipientIds: z.array(z.string().uuid()).min(1).max(250),
});
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json(await getCrewShareRecipients(user.id));
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json({
      ok: true,
      ...(await shareToCrew(user.id, schema.parse(await request.json()))),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to share with the Crew.');
  }
}
