import { NextResponse } from 'next/server';

import { advanceDraftSession, getDraftSession } from '@/server/api/draft';
import { listSaveStates } from '@/server/api/store';

type AdvancePayload = {
  draftSessionId?: string;
  saveId?: string;
};

const resolveSaveId = (draftSessionId: string, saveId?: string) => {
  if (saveId) {
    const direct = listSaveStates().find((entry) => entry.saveId === saveId);
    if (direct) {
      return saveId;
    }
  }
  return listSaveStates().find((entry) => entry.state.draftSessions?.[draftSessionId])?.saveId;
};

export const POST = async (request: Request) => {
  let body: AdvancePayload = {};
  try {
    body = (await request.json()) as AdvancePayload;
  } catch {
    body = {};
  }

  if (!body.draftSessionId) {
    return NextResponse.json({ ok: false, error: 'draftSessionId is required' }, { status: 400 });
  }

  try {
    const resolvedSaveId = resolveSaveId(body.draftSessionId, body.saveId);
    if (!resolvedSaveId) {
      return NextResponse.json({ ok: false, error: 'Draft session not found' }, { status: 404 });
    }

    const snapshot = getDraftSession(body.draftSessionId, resolvedSaveId);
    const currentPick = snapshot.picks[snapshot.currentPickIndex];
    if (currentPick?.ownerTeamAbbr === snapshot.userTeamAbbr) {
      return NextResponse.json({ ok: false, error: 'USER_ON_CLOCK' }, { status: 409 });
    }

    const session = advanceDraftSession(body.draftSessionId, resolvedSaveId);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to advance draft';
    console.error('Draft advance error:', error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
