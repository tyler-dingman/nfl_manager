import { NextResponse } from 'next/server';
import { ensureDraftTradeContext } from '@/server/api/draft-trade';
import { updateMockDraftTrades } from '@/server/logic/mock-draft-trades';
import { executeMockTrade, expireMockOffers, proposeMockTrade } from '@/lib/mock-draft-trades';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.saveId !== 'string' || typeof body.draftSessionId !== 'string')
      throw new Error('Missing draft session.');
    const { session, state } = ensureDraftTradeContext(body);
    if (session.mode !== 'mock') throw new Error('Trade Hub requires a mock draft.');
    updateMockDraftTrades(session, state);
    expireMockOffers(session);
    let result = { outcome: 'updated', reason: '' };
    if (body.action === 'accept' || body.action === 'decline') {
      const offer = session.tradeState!.offers.find((o) => o.id === body.offerId);
      if (!offer || offer.status !== 'active')
        throw new Error('This offer has expired or was already answered.');
      if (body.action === 'accept') executeMockTrade(session, offer);
      else offer.status = 'declined';
      result = { outcome: body.action === 'accept' ? 'accepted' : 'declined', reason: '' };
    } else if (body.action === 'propose') {
      if (
        typeof body.team !== 'string' ||
        !Array.isArray(body.send) ||
        !Array.isArray(body.receive) ||
        ![...body.send, ...body.receive].every((id) => typeof id === 'string')
      )
        throw new Error('Invalid trade package.');
      result = proposeMockTrade(session, body.team, body.send, body.receive, body.counterId);
    } else if (body.action !== 'sync') throw new Error('Unknown trade action.');
    session.tradeRevision = (session.tradeRevision ?? 0) + 1;
    return NextResponse.json({ ok: true, session, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to process trade.' },
      { status: 400 },
    );
  }
}
