import { NextResponse } from 'next/server';

import { pickDraftPlayer } from '@/server/api/draft';
import { getSaveHeaderSnapshot, getSaveStateResult } from '@/server/api/store';

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
    const session = pickDraftPlayer(body.draftSessionId, body.playerId, body.saveId);
    const stateResult = getSaveStateResult(body.saveId);
    const header = stateResult.ok ? getSaveHeaderSnapshot(stateResult.data) : undefined;
    return NextResponse.json({
      ok: true,
      session,
      header,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to pick player';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
