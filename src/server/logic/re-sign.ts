import type { PlayerRowDTO } from '@/types/player';

import { getAgentPersonaForPlayer } from '@/server/logic/agent-personas';
import { getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';
import { clampOfferYears, evaluateContractOffer } from '@/lib/contract-negotiation';
import { getDemandAavMillions } from '@/lib/contract-demand';
import { calculatePlayerInterestForTeam } from '@/lib/signing-interest';

export type ReSignOfferInput = {
  saveId: string;
  teamAbbr: string;
  player: PlayerRowDTO;
  teamRoster: PlayerRowDTO[];
  previousTeamAbbr?: string | null;
  years: number;
  apy: number;
  guaranteed: number;
  expectedApyOverride?: number;
};

export type ReSignScoreBreakdown = {
  moneyScore: number;
  yearsScore: number;
  guaranteedScore: number;
  teamFitScore: number;
  totalScore: number;
  interestScore: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  expectedGuaranteedPct: number;
  agentPersona: string;
  reasoningTags: string[];
  interestModifiers: string[];
};

const getExpectedApy = (rating: number, position: string) =>
  getDemandAavMillions({ position, ovr: rating });

const getExpectedGuaranteedPctByAge = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const scoreResignOffer = ({
  saveId,
  teamAbbr,
  player,
  teamRoster,
  previousTeamAbbr,
  years,
  apy,
  guaranteed,
  expectedApyOverride,
}: ReSignOfferInput): ReSignScoreBreakdown => {
  const persona = getAgentPersonaForPlayer(player.id);
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const baseExpectedApy = expectedApyOverride ?? getExpectedApy(rating, player.position);
  const expectedApy = Number((baseExpectedApy * persona.expectedApyMultiplier).toFixed(2));
  const preferredYears = getPreferredYearsForPlayer(player);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(6, preferredYears + 1),
  ];
  const expectedGuaranteedPct = Math.max(
    getExpectedGuaranteedPctByAge(age),
    persona.expectedGuaranteedPctTarget,
  );

  const clampedYears = clampOfferYears(years, 6);
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const evaluation = evaluateContractOffer({
    marketApy: expectedApy,
    offeredApy: apy,
    years: clampedYears,
    guaranteed,
    position: player.position,
    rating,
    maxYears: 6,
    seed: `${saveId}:${player.id}:${years}:${apy}:${guaranteed}`,
  });
  const fitInterest = calculatePlayerInterestForTeam(
    player,
    { teamAbbr, roster: teamRoster },
    { previousTeamAbbr },
  );
  const interestScore = clamp(
    Math.round(evaluation.score * 0.75 + fitInterest.finalInterest * 0.25),
    0,
    100,
  );
  const moneyScore = Math.round(evaluation.ratio * 40);
  const yearsScore = Math.round(25 * yearsFit);
  const guaranteedScore = Math.round(
    25 * Math.min(1, evaluation.guaranteedPct / expectedGuaranteedPct),
  );
  const teamFitScore = persona.key === 'TEAM_FIRST' ? 8 : persona.key === 'MARKET_HAWK' ? 3 : 5;
  const totalScore = moneyScore + yearsScore + guaranteedScore + teamFitScore;

  const reasoningTags: string[] = [];
  if (evaluation.ratio >= 1.0 || evaluation.ratio <= 0.9) reasoningTags.push('money');
  if (yearsScore >= 22 || yearsScore <= 10) reasoningTags.push('years');
  if (guaranteedScore >= 20 || guaranteedScore <= 10) reasoningTags.push('guaranteed');
  reasoningTags.push(persona.key.toLowerCase());
  fitInterest.modifiers.forEach((modifier) =>
    reasoningTags.push(modifier.toLowerCase().replace(/\s+/g, '_')),
  );

  return {
    moneyScore,
    yearsScore,
    guaranteedScore,
    teamFitScore,
    totalScore,
    interestScore,
    expectedApy,
    expectedYearsRange,
    expectedGuaranteedPct,
    agentPersona: persona.key,
    reasoningTags,
    interestModifiers: fitInterest.modifiers,
  };
};

export const decideResignAcceptance = (breakdown: ReSignScoreBreakdown): boolean => {
  return breakdown.interestScore >= 70;
};
