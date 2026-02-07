import { NextResponse } from 'next/server';

import { offerContract } from '@/server/api/players';
import { getSaveStateResult } from '@/server/api/store';
import { clampYears } from '@/lib/contracts';
import { decideFreeAgencyAcceptance, scoreFreeAgencyOffer } from '@/server/logic/free-agency';

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      saveId?: string;
      playerId?: string;
      years?: number;
      apy?: number;
    };

    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }

    if (!body.playerId || typeof body.years !== 'number' || typeof body.apy !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'playerId, years, and apy are required' },
        { status: 400 },
      );
    }

    const years = clampYears(body.years);
    const stateResult = getSaveStateResult(body.saveId);
    if (!stateResult.ok) {
      return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
    }
    const player = stateResult.data.freeAgents.find((agent) => agent.id === body.playerId);
    if (!player) {
      return NextResponse.json({ ok: false, error: 'Free agent not found' }, { status: 404 });
    }

    const breakdown = scoreFreeAgencyOffer(player, years, body.apy);
    const accepted = decideFreeAgencyAcceptance(breakdown, body.saveId, player.id);
    if (!accepted) {
      return NextResponse.json({
        ok: true,
        accepted: false,
        reason: 'Player declined the offer. Try improving years or APY.',
        interestScore: breakdown.interestScore,
      });
    }

    const result = offerContract(body.saveId, body.playerId, years, body.apy);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      accepted: true,
      interestScore: breakdown.interestScore,
      ...result.data,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Unable to submit offer right now.' },
      { status: 500 },
    );
  }
};
