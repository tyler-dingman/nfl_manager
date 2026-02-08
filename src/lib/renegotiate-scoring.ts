import { evaluateContractOffer, clampOfferYears } from '@/lib/contract-negotiation';
import { getDemandAavMillions } from '@/lib/contract-demand';

export type RenegotiateScoreInput = {
  age: number;
  rating: number;
  yearsRemaining: number;
  currentApy: number;
  currentGuaranteed: number;
  years: number;
  apy: number;
  guaranteed: number;
  position: string;
  seed?: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const estimateRenegotiateScore = (input: RenegotiateScoreInput) => {
  const { currentApy, years, apy, guaranteed, position, seed } = input;

  const clampedYears = clampOfferYears(years, 6);
  const marketApy =
    input.rating !== undefined
      ? getDemandAavMillions({ position, ovr: input.rating })
      : currentApy > 0
        ? currentApy
        : apy;

  const evaluation = evaluateContractOffer({
    marketApy,
    offeredApy: apy,
    years: clampedYears,
    guaranteed,
    position,
    rating: input.rating,
    maxYears: 6,
    seed: seed ? `re:${seed}` : undefined,
  });

  const score = clamp(evaluation.score);
  const label = score >= 80 ? 'Likely' : score >= 70 ? 'Maybe' : 'Not close';

  return {
    score,
    label,
    insult: score < 40,
  };
};
