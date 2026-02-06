import { NextResponse } from 'next/server';

import { getSaveStateResult, resignPlayerInState } from '@/server/api/store';
import type { PlayerRowDTO } from '@/types/player';

type ResignPayload = {
  saveId?: string;
  playerId?: string;
  years?: number;
  apy?: number;
  guaranteed?: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getExpectedYears = (age: number) => {
  if (age >= 30) return 1;
  if (age >= 27) return 2;
  return 3;
};

const getExpectedGuaranteedPct = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

const getExpectedApy = (rating: number) => Math.max(1, (rating - 60) * 0.6);

const computeInterestScore = (
  age: number,
  rating: number,
  years: number,
  apy: number,
  guaranteed: number,
) => {
  const expectedYears = getExpectedYears(age);
  const expectedApy = getExpectedApy(rating);
  const expectedGuaranteedPct = getExpectedGuaranteedPct(age);

  const moneyScore = clamp((apy / expectedApy) * 60, 0, 80);
  const yearsScore = years === expectedYears ? 15 : Math.abs(years - expectedYears) === 1 ? 8 : 0;
  const guaranteedPct = apy * years > 0 ? guaranteed / (apy * years) : 0;
  const guaranteedScore =
    guaranteedPct >= expectedGuaranteedPct ? 20 : 20 * (guaranteedPct / expectedGuaranteedPct);

  return clamp(moneyScore + yearsScore + guaranteedScore, 0, 100);
};

export const POST = async (request: Request) => {
  let body: ResignPayload = {};
  try {
    body = (await request.json()) as ResignPayload;
  } catch {
    body = {};
  }

  if (!body.saveId || !body.playerId || !body.years || !body.apy || !body.guaranteed) {
    return NextResponse.json(
      { ok: false, error: 'saveId, playerId, years, apy, and guaranteed are required' },
      { status: 400 },
    );
  }

  const stateResult = getSaveStateResult(body.saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  const player = stateResult.data.roster.find((item) => item.id === body.playerId) as
    | (PlayerRowDTO & { age?: number; rating?: number })
    | undefined;
  if (!player) {
    return NextResponse.json({ ok: false, error: 'Player not found' }, { status: 404 });
  }

  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const interestScore = computeInterestScore(age, rating, body.years, body.apy, body.guaranteed);

  if (interestScore < 65) {
    return NextResponse.json({
      ok: true,
      accepted: false,
      reason:
        'Player isn’t interested in this offer. Try increasing APY or guaranteed, or adjusting years.',
      interestScore,
    });
  }

  try {
    const result = resignPlayerInState(
      stateResult.data,
      body.playerId,
      body.years,
      body.apy,
      body.guaranteed,
    );

    return NextResponse.json({
      ok: true,
      accepted: true,
      header: result.header,
      player: result.player,
      interestScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to re-sign player';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
