import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import {
  getFrontOfficeTradeOffer,
  updateFrontOfficeTradeOfferStatus,
} from '@/server/front-office/events-repository';

async function handleGET(request: NextRequest, context: { params: Promise<{ offerId: string }> }) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const { offerId } = await context.params;
  const offer = await getFrontOfficeTradeOffer(user.id, offerId);
  return offer
    ? NextResponse.json({ ok: true, ...offer })
    : NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
}

const schema = z.object({ action: z.literal('reject') });
async function handlePATCH(
  request: NextRequest,
  context: { params: Promise<{ offerId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  schema.parse(await request.json());
  const { offerId } = await context.params;
  const offer = await updateFrontOfficeTradeOfferStatus(user.id, offerId, 'rejected');
  return offer
    ? NextResponse.json({ ok: true, ...offer })
    : NextResponse.json({ error: 'Offer is no longer pending.' }, { status: 409 });
}

export const GET = withFranchiseRoute(handleGET, {});
export const PATCH = withFranchiseRoute(handlePATCH, {});
