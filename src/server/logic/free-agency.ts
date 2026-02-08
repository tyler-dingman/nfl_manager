import type { PlayerRowDTO } from '@/types/player';

import { scoreFreeAgencyOffer as scoreFreeAgencyOfferEstimate } from '@/lib/free-agency-scoring';

export type FreeAgencyOfferBreakdown = {
  interestScore: number;
  acceptanceProbability: number;
  expectedApy: number;
  preferredYears: number;
  yearsFit: number;
};

export const scoreFreeAgencyOffer = (
  player: PlayerRowDTO,
  years: number,
  apy: number,
  guaranteed: number,
): FreeAgencyOfferBreakdown => {
  const estimate = scoreFreeAgencyOfferEstimate({ player, years, apy, guaranteed });
  const preferredYears = estimate.expectedYearsRange[0] + 1;
  return {
    interestScore: estimate.interestScore,
    acceptanceProbability: estimate.acceptanceProbability,
    expectedApy: estimate.expectedApy,
    preferredYears,
    yearsFit: estimate.yearsFit,
  };
};

export const decideFreeAgencyAcceptance = (breakdown: FreeAgencyOfferBreakdown): boolean => {
  return breakdown.acceptanceProbability >= 0.7;
};
