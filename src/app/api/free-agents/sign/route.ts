import { NextResponse } from 'next/server';

import { signFreeAgent } from '@/server/api/players';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { saveId?: string; playerId?: string };
  if (!body.saveId || !body.playerId) {
    return NextResponse.json({ error: 'saveId and playerId are required' }, { status: 400 });
  }

  return NextResponse.json(signFreeAgent(body.saveId, body.playerId));
};
