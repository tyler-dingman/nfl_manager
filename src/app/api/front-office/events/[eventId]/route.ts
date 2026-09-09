import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { updateFrontOfficeEvent } from '@/server/front-office/events-repository';

const schema = z.object({ action: z.enum(['read', 'dismiss']) });
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const { eventId } = await context.params;
  const { action } = schema.parse(await request.json());
  const event = await updateFrontOfficeEvent(user.id, eventId, action);
  return event
    ? NextResponse.json({ ok: true, event })
    : NextResponse.json({ error: 'Event not found.' }, { status: 404 });
}
