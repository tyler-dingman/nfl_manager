import type { PlayerRowDTO } from '@/types/player';
import { clampYears, getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';

export type FreeAgencyScoreEstimate = {
  interestScore: number;
  expectedApy: number;
  expectedYearsRange: [number, number];
  guaranteedPct: number;
  apyScore: number;
  yearsFit: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const POSITION_APY_CAPS: Record<string, number> = {
  QB: 60,
  RB: 20,
  WR: 35,
  LT: 25,
  LG: 22,
  C: 20,
  RG: 20,
  RT: 25,
  TE: 20,
  DT: 30,
  EDGE: 40,
  ED: 40,
  LB: 22,
  S: 20,
  CB: 22,
  P: 7,
  K: 7,
};

export const getPositionApyCap = (position: string) => {
  const normalized = position.toUpperCase();
  if (normalized === 'EDGE' || normalized === 'ED') {
    return POSITION_APY_CAPS.EDGE;
  }
  return POSITION_APY_CAPS[normalized] ?? 25;
};

const getExpectedApy = (rating: number, position: string) => {
  const base = Math.max(1, (rating - 60) * 0.6);
  const cap = getPositionApyCap(position);
  return Math.min(base, cap);
};

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
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const clampedYears = clampYears(years);
  const apyForScore = Math.min(apy, 60);
  const marketTop = getPositionApyCap(player.position);
  const apyScore = clamp(apyForScore / marketTop, 0, 1);
  const preferredYears = getPreferredYearsForPlayer(player);
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const guaranteedPct =
    apy > 0 && clampedYears > 0 ? clamp(guaranteed / (apy * clampedYears), 0, 1) : 0;

  const baseScore = 0.55 * apyScore + 0.25 * yearsFit + 0.2 * guaranteedPct;
  const synergy =
    clampedYears > 2 && guaranteedPct > 0.5 ? (clampedYears - 2) * (guaranteedPct - 0.5) * 0.08 : 0;
  const total = clamp(baseScore + synergy, 0, 1);
  const interestScore = Math.round(total * 100);
  const expectedApy = getExpectedApy(rating, player.position);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(5, preferredYears + 1),
  ];

  return {
    interestScore,
    expectedApy,
    expectedYearsRange,
    guaranteedPct,
    apyScore,
    yearsFit,
  };
};
