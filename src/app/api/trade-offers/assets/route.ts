import { NextResponse } from 'next/server';

import { getOrBuildProjectedRosterForTeam, getSaveStateResult } from '@/server/api/store';
import { toPlayerDTO } from '@/server/api/trades';

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

  return NextResponse.json({
    ok: true,
    partnerRoster: getOrBuildProjectedRosterForTeam(
      saveResult.data,
      body.partnerTeamAbbr.toUpperCase(),
    )
      .filter((player) => player.status?.toLowerCase() !== 'cut')
      .map((player) => toPlayerDTO(player)),
  });
};
