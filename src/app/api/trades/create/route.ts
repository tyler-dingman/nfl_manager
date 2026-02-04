import { NextResponse } from 'next/server';

import { createTrade } from '@/server/api/trades';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    saveId?: string;
    partnerTeamAbbr?: string;
    playerId?: string;
  };

  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  if (!body.partnerTeamAbbr) {
    return NextResponse.json({ ok: false, error: 'partnerTeamAbbr is required' }, { status: 400 });
  }

  const result = createTrade(body.saveId, body.partnerTeamAbbr, body.playerId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
