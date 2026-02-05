import { NextResponse } from 'next/server';

import { getDraftSession } from '@/server/api/draft';
import { listSaveStates } from '@/server/api/store';
import { clampNumber, getPickValue } from '@/lib/draft-utils';

type QuotePayload = {
  draftSessionId?: string;
  sendPickId?: string;
  receivePickId?: string;
  partnerTeamAbbr?: string;
  saveId?: string;
};

const resolveSaveId = (draftSessionId: string, saveId?: string) => {
  if (saveId) {
    return saveId;
  }
  return listSaveStates().find((entry) => entry.state.draftSessions[draftSessionId])?.saveId;
};

export const POST = async (request: Request) => {
  let body: QuotePayload = {};
  try {
    body = (await request.json()) as QuotePayload;
  } catch {
    body = {};
  }

  if (!body.draftSessionId || !body.sendPickId || !body.receivePickId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      {
        ok: false,
        error: 'draftSessionId, sendPickId, receivePickId, and partnerTeamAbbr required',
      },
      { status: 400 },
    );
  }

  const resolvedSaveId = resolveSaveId(body.draftSessionId, body.saveId);
  if (!resolvedSaveId) {
    return NextResponse.json({ ok: false, error: 'Draft session not found' }, { status: 404 });
  }

  const session = getDraftSession(body.draftSessionId, resolvedSaveId);
  const sendPick = session.picks.find((pick) => pick.id === body.sendPickId);
  const receivePick = session.picks.find((pick) => pick.id === body.receivePickId);

  if (!sendPick || !receivePick) {
    return NextResponse.json({ ok: false, error: 'Pick not found' }, { status: 404 });
  }
  if (sendPick.round !== 1 || receivePick.round !== 1) {
    return NextResponse.json(
      { ok: false, error: 'Only Round 1 picks are eligible' },
      { status: 400 },
    );
  }

  const sendValue = getPickValue(sendPick.overall);
  const receiveValue = getPickValue(receivePick.overall);
  const ratio = sendValue === 0 ? 1 : receiveValue / sendValue;
  let acceptanceProbability = clampNumber(0.05 + ratio * 0.85, 0.05, 0.9);

  if (receiveValue >= sendValue * 0.95) {
    acceptanceProbability = 0.9;
  }

  const onClockTeam = session.picks[session.currentPickIndex]?.ownerTeamAbbr;
  if (onClockTeam === body.partnerTeamAbbr && receiveValue < sendValue) {
    acceptanceProbability = clampNumber(acceptanceProbability + 0.05, 0.05, 0.9);
  }

  const verdict =
    acceptanceProbability >= 0.7 ? 'likely' : acceptanceProbability >= 0.45 ? 'fair' : 'unlikely';

  return NextResponse.json({
    ok: true,
    sendValue,
    receiveValue,
    acceptanceProbability,
    verdict,
  });
};
