import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { resolveFrontOfficeEventsForPlayer } from '@/server/front-office/events-repository';
import {
  getFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
} from '@/server/front-office/repository';

const schema = z.object({
  saveId: z.string().min(1).max(160),
  playerId: z.string().min(1).max(200),
  resolution: z.enum(['signed', 'invalidated']),
});

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const input = schema.parse(await request.json());
  const events = await resolveFrontOfficeEventsForPlayer(
    user.id,
    input.saveId,
    input.playerId,
    input.resolution,
  );
  const metadata = await getFrontOfficeSaveMetadata(user.id, input.saveId);
  const simulation = metadata?.simulation;
  const negotiation = simulation?.contractNegotiations?.[input.playerId];
  if (metadata && simulation && negotiation) {
    negotiation.state = input.resolution === 'signed' ? 'signed' : 'expired';
    negotiation.updatedAt = new Date().toISOString();
    await saveFranchiseSimulation({
      userId: user.id,
      saveId: input.saveId,
      expectedVersion: metadata.version ?? 1,
      simulation,
    });
  }
  return NextResponse.json({ ok: true, events });
}
