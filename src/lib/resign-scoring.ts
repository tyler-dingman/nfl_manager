import type { AgentPersona } from '@/lib/agent-personas';
import { getAgentPersonaForPlayer } from '@/lib/agent-personas';
import type { PlayerRowDTO } from '@/types/player';
import { clampYears, getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';

export type ResignScoreEstimate = {
  interestScore: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  expectedGuaranteedPct: number;
  agentPersona: AgentPersona;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getExpectedApy = (rating: number) => Math.max(1, (rating - 60) * 0.6);

const getExpectedGuaranteedPctByAge = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

export const estimateResignInterest = ({
  playerId,
  age,
  rating,
  years,
  apy,
  guaranteed,
  expectedApyOverride,
}: {
  playerId: string;
  age: number;
  rating: number;
  years: number;
  apy: number;
  guaranteed: number;
  expectedApyOverride?: number;
}): ResignScoreEstimate => {
  const persona = getAgentPersonaForPlayer(playerId);
  const baseExpectedApy = expectedApyOverride ?? getExpectedApy(rating);
  const expectedApy = Number((baseExpectedApy * persona.expectedApyMultiplier).toFixed(2));
  const seedPlayer: PlayerRowDTO = {
    id: playerId,
    firstName: '',
    lastName: '',
    position: '',
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

  const ratio = expectedApy === 0 ? 0 : apy / expectedApy;
  let moneyScore =
    ratio >= 1.05
      ? 40
      : ratio >= 1.0
        ? 36
        : ratio >= 0.95
          ? 28
          : ratio >= 0.9
            ? 18
            : ratio >= 0.85
              ? 8
              : 0;
  if (ratio < persona.discountTolerance) {
    moneyScore = Math.max(0, moneyScore - 6);
  }

  const clampedYears = clampYears(years);
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const yearsScore = Math.round(25 * yearsFit);

  const guaranteedPct = apy * clampedYears > 0 ? guaranteed / (apy * clampedYears) : 0;
  const guaranteedScore =
    guaranteedPct >= expectedGuaranteedPct
      ? 25
      : guaranteedPct >= expectedGuaranteedPct - 0.1
        ? 18
        : guaranteedPct >= expectedGuaranteedPct - 0.2
          ? 10
          : 0;

  const teamFitScore = persona.key === 'TEAM_FIRST' ? 8 : persona.key === 'MARKET_HAWK' ? 3 : 5;

  const totalScore = moneyScore + yearsScore + guaranteedScore + teamFitScore;
  const interestScore = clamp(Math.round(totalScore), 0, 100);

  return {
    interestScore,
    expectedApy,
    expectedYearsRange,
    expectedGuaranteedPct,
    agentPersona: persona,
  };
};
