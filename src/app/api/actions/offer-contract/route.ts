import { NextResponse } from 'next/server';

import { offerContract } from '@/server/api/players';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    saveId?: string;
    playerId?: string;
    years?: number;
    apy?: number;
  };

  if (!body.saveId || !body.playerId || !body.years || !body.apy) {
    return NextResponse.json(
      { error: 'saveId, playerId, years, and apy are required' },
      { status: 400 },
    );
  }

  return NextResponse.json(offerContract(body.saveId, body.playerId, body.years, body.apy));
};
