import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import {
  resolveFrontOfficeEventsForPlayer,
  updateFrontOfficeEvent,
} from '@/server/front-office/events-repository';
import {
  getFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
} from '@/server/front-office/repository';

const schema = z.object({
  action: z.enum(['read', 'dismiss', 'resolve']),
  resolution: z.enum(['signed', 'invalidated']).optional(),
});
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const { eventId } = await context.params;
  const { action, resolution } = schema.parse(await request.json());
  const event = await updateFrontOfficeEvent(
    user.id,
    eventId,
    action === 'resolve' ? 'read' : action,
  );
  if (action === 'resolve' && event?.playerId) {
    const resolvedAs = resolution ?? 'signed';
    await resolveFrontOfficeEventsForPlayer(user.id, event.saveId, event.playerId, resolvedAs);
    const metadata = await getFrontOfficeSaveMetadata(user.id, event.saveId);
    const simulation = metadata?.simulation;
    const negotiation = simulation?.contractNegotiations?.[event.playerId];
    if (metadata && simulation && negotiation) {
      negotiation.state = resolvedAs === 'signed' ? 'signed' : 'expired';
      negotiation.updatedAt = new Date().toISOString();
      await saveFranchiseSimulation({
        userId: user.id,
        saveId: event.saveId,
        expectedVersion: metadata.version ?? 1,
        simulation,
      });
    }
  }
  return event
    ? NextResponse.json({ ok: true, event })
    : NextResponse.json({ error: 'Event not found.' }, { status: 404 });
}
