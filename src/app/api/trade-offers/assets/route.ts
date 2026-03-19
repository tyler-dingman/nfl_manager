import { NextResponse } from 'next/server';

import { getSaveStateResult } from '@/server/api/store';
import { buildTeamContexts } from '@/server/logic/trade-offer-generator';

type TradeOfferAssetsBody = {
  saveId?: string;
  partnerTeamAbbr?: string;
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as TradeOfferAssetsBody;
  if (!body.saveId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      { ok: false, error: 'Missing trade offer asset inputs.' },
      { status: 400 },
    );
  }

  const saveResult = getSaveStateResult(body.saveId);
  if (!saveResult.ok) {
    return NextResponse.json({ ok: false, error: saveResult.error }, { status: 404 });
  }

  const contexts = buildTeamContexts(saveResult.data);
  const partnerTeam = contexts.get(body.partnerTeamAbbr.toUpperCase());
  if (!partnerTeam) {
    return NextResponse.json(
      { ok: false, error: 'Unable to resolve proposing team assets.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    partnerRoster: partnerTeam.roster,
  });
};
