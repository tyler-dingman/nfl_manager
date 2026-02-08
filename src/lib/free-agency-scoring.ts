import type { PlayerRowDTO } from '@/types/player';
import { getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';
import {
  clampOfferYears,
  evaluateContractOffer,
  getApyCapForPosition,
} from '@/lib/contract-negotiation';
import { getDemandAavMillions } from '@/lib/contract-demand';

export type FreeAgencyScoreEstimate = {
  interestScore: number;
  acceptanceProbability: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  guaranteedPct: number;
  apyScore: number;
  yearsFit: number;
};

const getExpectedApy = (rating: number, position: string) =>
  getDemandAavMillions({ position, ovr: rating });

export const scoreFreeAgencyOffer = ({
  player,
  years,
  apy,
  guaranteed,
}: {
  player: PlayerRowDTO;
  years: number;
  apy: number;
  guaranteed: number;
}): FreeAgencyScoreEstimate => {
  const rating = player.rating ?? 75;
  const marketApy =
    player.rating !== undefined
      ? getDemandAavMillions({ position: player.position, ovr: player.rating })
      : player.marketValue !== null && player.marketValue !== undefined
        ? player.marketValue / 1_000_000
        : getApyCapForPosition(player.position);

  const clampedYears = clampOfferYears(years, 5);
  const preferredYears = getPreferredYearsForPlayer(player);
  const yearsFit = getYearsFit(preferredYears, clampedYears);

  const evaluation = evaluateContractOffer({
    marketApy,
    offeredApy: apy,
    years: clampedYears,
    guaranteed,
    position: player.position,
    rating,
    maxYears: 5,
    seed: `fa:${player.id}:${years}:${apy}:${guaranteed}`,
  });

  const expectedApy = getExpectedApy(rating, player.position);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(5, preferredYears + 1),
  ];

  return {
    interestScore: evaluation.score,
    acceptanceProbability: evaluation.probability,
    expectedApy,
    expectedYearsRange,
    guaranteedPct: evaluation.guaranteedPct,
    apyScore: evaluation.ratio,
    yearsFit,
  };
};
