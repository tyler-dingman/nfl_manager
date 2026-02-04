import { NextResponse } from 'next/server';

import { pickDraftPlayer } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    playerId?: string;
  };

  if (!body.draftSessionId || !body.playerId) {
    return NextResponse.json(
      { error: 'draftSessionId and playerId are required' },
      { status: 400 },
    );
  }

  return NextResponse.json(pickDraftPlayer(body.draftSessionId, body.playerId));
};
