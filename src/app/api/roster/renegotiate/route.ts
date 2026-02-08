import { NextResponse } from 'next/server';

import { getSaveStateResult } from '@/server/api/store';
import { renegotiatePlayerInState, markPlayerDisgruntled } from '@/server/api/store';
import { evaluateRenegotiateOffer } from '@/server/logic/renegotiate';
import { clampOfferYears } from '@/lib/contract-negotiation';

export const POST = async (request: Request) => {
  let body: {
    saveId?: string;
    playerId?: string;
    years?: number;
    apy?: number;
    guaranteed?: number;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const { saveId, playerId, years, apy, guaranteed } = body;
  if (!saveId || !playerId || !years || apy === undefined || guaranteed === undefined) {
    return NextResponse.json(
      { ok: false, error: 'saveId, playerId, years, apy, guaranteed are required' },
      { status: 400 },
    );
  }

  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  const state = stateResult.data;
  const player = state.roster.find((entry) => entry.id === playerId);
  if (!player) {
    return NextResponse.json({ ok: false, error: 'Player not found' }, { status: 404 });
  }

  const clampedYears = clampOfferYears(years, 6);
  const evaluation = evaluateRenegotiateOffer({
    saveId,
    player,
    years: clampedYears,
    apy,
    guaranteed,
  });

  if (!evaluation.accepted) {
    markPlayerDisgruntled(state, playerId);
    return NextResponse.json({
      ok: true,
      accepted: false,
      score: evaluation.score,
      label: evaluation.label,
      quote: evaluation.quote,
    });
  }

  const result = renegotiatePlayerInState(state, playerId, clampedYears, apy, guaranteed);

  return NextResponse.json({
    ok: true,
    accepted: true,
    score: evaluation.score,
    label: evaluation.label,
    quote: evaluation.quote,
    player: result.player,
    header: result.header,
  });
};
