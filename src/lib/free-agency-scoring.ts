import type { PlayerRowDTO } from '@/types/player';
import { getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';
import {
  clampOfferYears,
  evaluateContractOffer,
  getApyCapForPosition,
} from '@/lib/contract-negotiation';
import { calculatePlayerInterestForTeam } from '@/lib/signing-interest';
import { getFreeAgentExpectedApy } from '@/lib/free-agent-valuation';

export type FreeAgencyScoreEstimate = {
  interestScore: number;
  acceptanceProbability: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  guaranteedPct: number;
  apyScore: number;
  yearsFit: number;
};

export const scoreFreeAgencyOffer = ({
  player,
  years,
  apy,
  guaranteed,
  teamAbbr,
  teamRoster,
  previousTeamAbbr,
}: {
  player: PlayerRowDTO;
  years: number;
  apy: number;
  guaranteed: number;
  teamAbbr?: string;
  teamRoster?: PlayerRowDTO[];
  previousTeamAbbr?: string | null;
}): FreeAgencyScoreEstimate => {
  const rating = player.rating ?? 75;
  const marketApy =
    player.freeAgentProfile?.expectedAnnualValue ??
    getFreeAgentExpectedApy({
      position: player.position,
      rating: player.rating,
      marketValue: player.marketValue,
    }) ??
    getApyCapForPosition(player.position);

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

  const interestBreakdown =
    teamAbbr && teamRoster
      ? calculatePlayerInterestForTeam(
          player,
          { teamAbbr, roster: teamRoster },
          { previousTeamAbbr },
        )
      : null;
  const adjustedInterest = interestBreakdown
    ? Math.round(evaluation.score * 0.75 + interestBreakdown.finalInterest * 0.25)
    : evaluation.score;

  const expectedApy =
    getFreeAgentExpectedApy({
      position: player.position,
      rating: player.rating,
      marketValue: player.marketValue,
    }) ?? getApyCapForPosition(player.position);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(5, preferredYears + 1),
  ];

  return {
    interestScore: adjustedInterest,
    acceptanceProbability: evaluation.probability,
    expectedApy,
    expectedYearsRange,
    guaranteedPct: evaluation.guaranteedPct,
    apyScore: evaluation.ratio,
    yearsFit,
  };
};
