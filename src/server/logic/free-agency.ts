import type { PlayerRowDTO } from '@/types/player';

import { scoreFreeAgencyOffer as scoreFreeAgencyOfferEstimate } from '@/lib/free-agency-scoring';

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const randomChance = (seed: string) => {
  const value = hashString(seed) % 1000;
  return value / 1000;
};

export type FreeAgencyOfferBreakdown = {
  interestScore: number;
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
    expectedApy: estimate.expectedApy,
    preferredYears,
    yearsFit: estimate.yearsFit,
  };
};

export const decideFreeAgencyAcceptance = (
  breakdown: FreeAgencyOfferBreakdown,
  saveId: string,
  playerId: string,
): boolean => {
  if (breakdown.interestScore >= 70) return true;
  const chance = breakdown.interestScore >= 60 ? 0.6 : breakdown.interestScore >= 45 ? 0.2 : 0.05;
  const roll = randomChance(`${saveId}:${playerId}:${breakdown.interestScore}`);
  return roll <= chance;
};
