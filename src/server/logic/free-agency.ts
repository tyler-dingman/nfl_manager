import type { PlayerRowDTO } from '@/types/player';

import { clampYears, getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getExpectedApy = (rating: number) => Math.max(1, (rating - 60) * 0.6);

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
): FreeAgencyOfferBreakdown => {
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const preferredYears = getPreferredYearsForPlayer(player);
  const clampedYears = clampYears(years);
  const expectedApy = getExpectedApy(rating);
  const ratio = expectedApy === 0 ? 0 : apy / expectedApy;
  const moneyScore =
    ratio >= 1.05
      ? 60
      : ratio >= 1.0
        ? 54
        : ratio >= 0.95
          ? 42
          : ratio >= 0.9
            ? 30
            : ratio >= 0.85
              ? 15
              : 0;
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const yearsScore = Math.round(25 * yearsFit);
  const teamFitScore = age >= 32 ? 8 : 10;
  const totalScore = moneyScore + yearsScore + teamFitScore;
  const interestScore = clamp(Math.round(totalScore), 0, 100);
  return { interestScore, expectedApy, preferredYears, yearsFit };
};

export const decideFreeAgencyAcceptance = (
  breakdown: FreeAgencyOfferBreakdown,
  saveId: string,
  playerId: string,
): boolean => {
  if (breakdown.interestScore >= 75) return true;
  const chance =
    breakdown.interestScore >= 60 ? 0.6 : breakdown.interestScore >= 45 ? 0.2 : 0.05;
  const roll = randomChance(`${saveId}:${playerId}:${breakdown.interestScore}`);
  return roll <= chance;
};
