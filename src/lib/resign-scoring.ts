import type { AgentPersona } from '@/lib/agent-personas';
import { getAgentPersonaForPlayer } from '@/lib/agent-personas';

export type ResignScoreEstimate = {
  interestScore: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  expectedGuaranteedPct: number;
  agentPersona: AgentPersona;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getAgeBucket = (age: number): [number, number] => {
  if (age >= 30) return [1, 2];
  if (age >= 27) return [2, 3];
  return [3, 4];
};

const getExpectedApy = (rating: number) => Math.max(1, (rating - 60) * 0.6);

const getExpectedGuaranteedPctByAge = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

const within = (value: number, min: number, max: number) => value >= min && value <= max;

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
  const [ageMinYears, ageMaxYears] = getAgeBucket(age);
  const expectedYearsRange: [number, number] = [
    Math.max(ageMinYears, persona.yearsPreference.min),
    Math.min(ageMaxYears, persona.yearsPreference.max),
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

  const yearsScore = within(years, expectedYearsRange[0], expectedYearsRange[1])
    ? 25
    : Math.min(Math.abs(years - expectedYearsRange[0]), Math.abs(years - expectedYearsRange[1])) ===
        1
      ? 15
      : 5;

  const guaranteedPct = apy * years > 0 ? guaranteed / (apy * years) : 0;
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
