import type { AgentPersona } from '@/lib/agent-personas';
import { getAgentPersonaForPlayer } from '@/lib/agent-personas';
import type { PlayerRowDTO } from '@/types/player';
import { getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';
import { clampOfferYears, evaluateContractOffer } from '@/lib/contract-negotiation';
import { getDemandAavMillions } from '@/lib/contract-demand';

export type ResignScoreEstimate = {
  interestScore: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  expectedGuaranteedPct: number;
  agentPersona: AgentPersona;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getExpectedApy = (rating: number, position: string) =>
  getDemandAavMillions({ position, ovr: rating });

const getExpectedGuaranteedPctByAge = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

export const estimateResignInterest = ({
  playerId,
  age,
  rating,
  position,
  years,
  apy,
  guaranteed,
  expectedApyOverride,
}: {
  playerId: string;
  age: number;
  rating: number;
  position: string;
  years: number;
  apy: number;
  guaranteed: number;
  expectedApyOverride?: number;
}): ResignScoreEstimate => {
  const persona = getAgentPersonaForPlayer(playerId);
  const baseExpectedApy = expectedApyOverride ?? getExpectedApy(rating, position);
  const expectedApy = Number((baseExpectedApy * persona.expectedApyMultiplier).toFixed(2));
  const seedPlayer: PlayerRowDTO = {
    id: playerId,
    firstName: '',
    lastName: '',
    position,
    age,
    rating,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Expiring',
  };
  const preferredYears = getPreferredYearsForPlayer(seedPlayer);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(5, preferredYears + 1),
  ];
  const expectedGuaranteedPct = Math.max(
    getExpectedGuaranteedPctByAge(age),
    persona.expectedGuaranteedPctTarget,
  );

  const clampedYears = clampOfferYears(years, 5);
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const evaluation = evaluateContractOffer({
    marketApy: expectedApy,
    offeredApy: apy,
    years: clampedYears,
    guaranteed,
    position,
    maxYears: 5,
    seed: `resign:${playerId}:${years}:${apy}:${guaranteed}`,
  });
  const interestScore = clamp(evaluation.score, 0, 100);
  const moneyScore = Math.round(evaluation.ratio * 40);
  const yearsScore = Math.round(25 * yearsFit);
  const guaranteedScore = Math.round(
    25 * Math.min(1, evaluation.guaranteedPct / expectedGuaranteedPct),
  );
  const teamFitScore = persona.key === 'TEAM_FIRST' ? 8 : persona.key === 'MARKET_HAWK' ? 3 : 5;

  return {
    interestScore,
    expectedApy,
    expectedYearsRange,
    expectedGuaranteedPct,
    agentPersona: persona,
  };
};
