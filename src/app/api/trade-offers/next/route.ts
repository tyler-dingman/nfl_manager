import { NextResponse } from 'next/server';

import { getSaveStateResult } from '@/server/api/store';
import { generateTradeOffers } from '@/server/logic/trade-offer-generator';
import type { TradeOfferGenerationContext } from '@/types/trade-offers';

export const POST = async (request: Request) => {
  const body = (await request.json()) as Partial<TradeOfferGenerationContext>;

  if (!body.saveId || !body.userTeamAbbr || !body.phase || !body.trigger) {
    return NextResponse.json(
      { ok: false, error: 'Missing trade-offer generation inputs.' },
      { status: 400 },
    );
  }

  const saveResult = getSaveStateResult(body.saveId);
  if (!saveResult.ok) {
    return NextResponse.json({ ok: false, error: saveResult.error }, { status: 404 });
  }

  const result = generateTradeOffers(saveResult.data, {
    saveId: body.saveId,
    userTeamAbbr: body.userTeamAbbr,
    phase: body.phase,
    trigger: body.trigger,
    shownOfferIds: body.shownOfferIds ?? [],
    mutedTeamAbbrs: body.mutedTeamAbbrs ?? [],
    draftSessionId: body.draftSessionId ?? null,
    draftCurrentPickIndex: body.draftCurrentPickIndex ?? null,
  });

  return NextResponse.json({
    ok: true,
    offers: result.offers,
    debug: process.env.NODE_ENV === 'production' ? undefined : result.debug,
  });
};
