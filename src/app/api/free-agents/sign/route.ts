import { NextResponse } from 'next/server';

import { signFreeAgent } from '@/server/api/players';
import {
  ensureSaveState,
  getSaveState,
  getSaveStateResult,
  hydrateOffseasonFreeAgencyState,
} from '@/server/api/store';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    saveId?: string;
    playerId?: string;
    teamAbbr?: string;
  };
  if (!body.saveId || !body.playerId) {
    return NextResponse.json({ error: 'saveId and playerId are required' }, { status: 400 });
  }

  if (!getSaveState(body.saveId) && body.teamAbbr) {
    ensureSaveState(body.saveId, body.teamAbbr);
  }

  const stateResult = getSaveStateResult(body.saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  await hydrateOffseasonFreeAgencyState(stateResult.data);
  return NextResponse.json(signFreeAgent(body.saveId, body.playerId));
};
