import { NextResponse } from 'next/server';

import { createTrade } from '@/server/api/trades';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    saveId?: string;
    partnerTeamAbbr?: string;
    playerId?: string;
  };

  if (!body.saveId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      { error: 'saveId and partnerTeamAbbr are required' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    createTrade(body.saveId, body.partnerTeamAbbr, body.playerId),
  );
};
