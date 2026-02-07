import type { PlayerRowDTO } from '@/types/player';
import { clampYears, getPreferredYearsForPlayer, getYearsFit } from '@/lib/contracts';

export type FreeAgencyScoreEstimate = {
  interestScore: number;
  acceptanceProbability: number;
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
  OT: 25,
  T: 25,
  G: 22,
  DL: 30,
  IDL: 30,
  FS: 20,
  SS: 20,
};

const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (normalized === 'EDGE' || normalized === 'ED') return 'EDGE';
  if (normalized === 'FS' || normalized === 'SS') return 'S';
  if (normalized === 'OT') return 'LT';
  if (normalized === 'T') return 'LT';
  if (normalized === 'G') return 'LG';
  if (normalized === 'IDL') return 'DT';
  if (normalized === 'DL') return 'DT';
  return normalized;
};

export const getPositionApyCap = (position: string) =>
  POSITION_APY_CAPS[normalizePosition(position)] ?? 25;

const getExpectedApy = (rating: number, position: string) => {
  const base = Math.max(1, (rating - 60) * 0.6);
  const cap = getPositionApyCap(position);
  return Math.min(base, cap);
};

const baseFromRatio = (ratio: number) => {
  const clamped = clamp(ratio, 0.85, 1.15);
  if (clamped >= 1.0) {
    return 0.75 + Math.min(0.1, (clamped - 1.0) * 0.2);
  }
  if (clamped >= 0.95) {
    return 0.62 + (clamped - 0.95) * 2.6;
  }
  if (clamped >= 0.9) {
    return 0.45 + (clamped - 0.9) * 3.4;
  }
  return 0.35 + (clamped - 0.85) * 2.0;
};

const getYearsBonus = (years: number) => {
  switch (years) {
    case 5:
      return 0.18;
    case 4:
      return 0.16;
    case 3:
      return 0.13;
    case 2:
      return 0.08;
    default:
      return 0.0;
  }
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
  const rating = player.rating ?? 75;
  const clampedYears = clampYears(years);
  const apyForScore = Math.min(apy, 60);
  const marketApy =
    player.marketValue !== null && player.marketValue !== undefined
      ? player.marketValue / 1_000_000
      : getPositionApyCap(player.position);
  const ratio = marketApy > 0 ? apyForScore / marketApy : 0;
  const apyScore = clamp(apyForScore / getPositionApyCap(player.position), 0, 1);
  const preferredYears = getPreferredYearsForPlayer(player);
  const yearsFit = getYearsFit(preferredYears, clampedYears);
  const guaranteedPct =
    apy > 0 && clampedYears > 0 ? clamp(guaranteed / (apy * clampedYears), 0, 1) : 0;

  // Base probability is centered around market APY, then bumped by years + guarantees.
  const baseProbability = baseFromRatio(ratio);
  const yearsBonus = getYearsBonus(clampedYears);
  const guaranteeBonus = clamp(0.2 * (guaranteedPct - 0.25), 0, 0.15);
  const synergy =
    clampedYears > 2 && guaranteedPct > 0.5 ? (clampedYears - 2) * (guaranteedPct - 0.5) * 0.08 : 0;
  const acceptanceProbability = clamp(
    baseProbability + yearsBonus + guaranteeBonus + synergy,
    0.05,
    0.9,
  );

  const baseScore = 0.55 * apyScore + 0.25 * yearsFit + 0.2 * guaranteedPct;
  const total = clamp(baseScore + synergy, 0, 1);
  const interestScore = Math.round(total * 100);
  const expectedApy = getExpectedApy(rating, player.position);
  const expectedYearsRange: [number, number] = [
    Math.max(1, preferredYears - 1),
    Math.min(5, preferredYears + 1),
  ];

  return {
    interestScore,
    acceptanceProbability,
    expectedApy,
    expectedYearsRange,
    guaranteedPct,
    apyScore,
    yearsFit,
  };
};
