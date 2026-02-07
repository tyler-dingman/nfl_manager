import type { PlayerRowDTO } from '@/types/player';

import { getAgentPersonaForPlayer } from '@/server/logic/agent-personas';
import { clampYears, getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';

export type ReSignOfferInput = {
  saveId: string;
  teamAbbr: string;
  player: PlayerRowDTO;
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
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getExpectedApy = (rating: number) => Math.max(1, (rating - 60) * 0.6);

const getExpectedGuaranteedPctByAge = (age: number) => {
  if (age >= 30) return 0.35;
  if (age >= 27) return 0.45;
  return 0.55;
};

const jitterFromSeed = (seed: string) => {
  const value = hashString(seed) % 13;
  return value - 6;
};

const randomChance = (seed: string) => {
  const value = hashString(seed) % 1000;
  return value / 1000;
};

export const scoreResignOffer = ({
  saveId,
  teamAbbr,
  player,
  years,
  apy,
  guaranteed,
  expectedApyOverride,
}: ReSignOfferInput): ReSignScoreBreakdown => {
  const persona = getAgentPersonaForPlayer(player.id);
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const baseExpectedApy = expectedApyOverride ?? getExpectedApy(rating);
  const expectedApy = Number((baseExpectedApy * persona.expectedApyMultiplier).toFixed(2));
  const preferredYears = getPreferredYearsForPlayer(player);
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
  const jitter = jitterFromSeed(
    `${saveId}:${player.id}:${years}:${apy}:${guaranteed}:${Math.floor(Date.now() / 30000)}`,
  );
  const interestScore = clamp(Math.round(totalScore + jitter), 0, 100);

  const reasoningTags: string[] = [];
  if (moneyScore >= 36 || moneyScore <= 18) reasoningTags.push('money');
  if (yearsScore >= 25 || yearsScore <= 10) reasoningTags.push('years');
  if (guaranteedScore >= 25 || guaranteedScore <= 10) reasoningTags.push('guaranteed');
  reasoningTags.push(persona.key.toLowerCase());

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
  };
};

export const decideResignAcceptance = (
  breakdown: ReSignScoreBreakdown,
  saveId: string,
  playerId: string,
): boolean => {
  if (breakdown.interestScore >= 75) return true;
  const chance = breakdown.interestScore >= 60 ? 0.65 : breakdown.interestScore >= 45 ? 0.25 : 0.0;
  if (chance <= 0) return false;
  const roll = randomChance(`${saveId}:${playerId}:${breakdown.interestScore}`);
  return roll <= chance;
};
