import { NextResponse } from 'next/server';

import { pickDraftPlayer } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    playerId?: string;
    saveId?: string;
  };

  if (!body.draftSessionId || !body.playerId || !body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId, playerId, and saveId are required' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      data: pickDraftPlayer(body.draftSessionId, body.playerId, body.saveId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to pick player';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
