import { NextResponse } from 'next/server';

import { acceptDraftTradeOffer } from '@/server/api/draft';
import type { TradeOfferDTO } from '@/types/trade-offers';

type AcceptDraftTradeOfferBody = {
  saveId?: string;
  draftSessionId?: string;
  offer?: TradeOfferDTO;
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as AcceptDraftTradeOfferBody;

  if (!body.saveId || !body.draftSessionId || !body.offer) {
    return NextResponse.json(
      { ok: false, error: 'Missing draft trade acceptance inputs.' },
      { status: 400 },
    );
  }

  try {
    const accepted = acceptDraftTradeOffer(body.draftSessionId, body.saveId, body.offer);
    return NextResponse.json({
      ok: true,
      accepted: true,
      session: accepted.session,
      roster: accepted.roster,
      header: accepted.header,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to accept draft trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
