import { NextResponse } from 'next/server';

import { applyDraftTrade, getDraftSession } from '@/server/api/draft';
import { clampNumber, getPickValue } from '@/lib/draft-utils';

type ProposePayload = {
  draftSessionId?: string;
  saveId?: string;
  sendPickId?: string;
  receivePickId?: string;
  partnerTeamAbbr?: string;
};

const computeAcceptance = (sendValue: number, receiveValue: number) => {
  if (receiveValue >= sendValue * 0.95) {
    return 0.9;
  }
  const ratio = sendValue === 0 ? 1 : receiveValue / sendValue;
  return clampNumber(0.05 + ratio * 0.85, 0.05, 0.9);
};

export const POST = async (request: Request) => {
  let body: ProposePayload = {};
  try {
    body = (await request.json()) as ProposePayload;
  } catch {
    body = {};
  }

  if (
    !body.draftSessionId ||
    !body.saveId ||
    !body.sendPickId ||
    !body.receivePickId ||
    !body.partnerTeamAbbr
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'draftSessionId, saveId, sendPickId, receivePickId, and partnerTeamAbbr required',
      },
      { status: 400 },
    );
  }

  try {
    const session = getDraftSession(body.draftSessionId, body.saveId);
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
    if (sendPick.ownerTeamAbbr !== session.userTeamAbbr) {
      return NextResponse.json({ ok: false, error: 'You do not own that pick' }, { status: 400 });
    }
    if (receivePick.ownerTeamAbbr !== body.partnerTeamAbbr) {
      return NextResponse.json(
        { ok: false, error: 'Partner does not own that pick' },
        { status: 400 },
      );
    }
    if (sendPick.selectedPlayerId || receivePick.selectedPlayerId) {
      return NextResponse.json({ ok: false, error: 'Pick already used' }, { status: 400 });
    }

    const sendValue = getPickValue(sendPick.overall);
    const receiveValue = getPickValue(receivePick.overall);
    let acceptanceProbability = computeAcceptance(sendValue, receiveValue);

    const onClockTeam = session.picks[session.currentPickIndex]?.ownerTeamAbbr;
    if (onClockTeam === body.partnerTeamAbbr && receiveValue < sendValue) {
      acceptanceProbability = clampNumber(acceptanceProbability + 0.05, 0.05, 0.9);
    }

    const accepted = receiveValue >= sendValue * 0.95 || Math.random() <= acceptanceProbability;

    if (!accepted) {
      return NextResponse.json({
        ok: true,
        accepted: false,
        reason: 'Offer did not meet the partner team value threshold.',
      });
    }

    const updatedSession = applyDraftTrade(
      body.draftSessionId,
      body.partnerTeamAbbr,
      [body.sendPickId],
      [body.receivePickId],
      body.saveId,
    );

    return NextResponse.json({ ok: true, accepted: true, session: updatedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
