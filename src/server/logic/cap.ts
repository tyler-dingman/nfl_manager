export const CAP_HIT_MULTIPLIERS: Record<number, number[]> = {
  1: [1.0],
  2: [0.7, 1.3],
  3: [0.5, 0.9, 1.2],
  4: [0.45, 0.8, 1.05, 1.2],
  5: [0.4, 0.7, 0.95, 1.1, 1.25],
  6: [0.3, 0.55, 0.75, 0.95, 1.1, 1.35],
};

export const YEAR_ONE_CAP_MULTIPLIERS: Record<number, number> = {
  1: 0.9,
  2: 0.6,
  3: 0.4,
  4: 0.3,
  5: 0.2,
  6: 0.15,
};

export const formatMoneyMillions = (value: number): string => `$${value.toFixed(1)}M`;

export const parseMoneyMillions = (value: string): number =>
  Number(value.replace(/[$M]/g, '')) || 0;

export const getCapHitSchedule = (apy: number, years: number): number[] => {
  const multipliers = CAP_HIT_MULTIPLIERS[years];
  if (!multipliers) {
    throw new Error('Invalid contract length');
  }

  return multipliers.map((multiplier) => Number((apy * multiplier).toFixed(1)));
};

export const getYearOneCapHit = (apy: number, years: number): number =>
  Number((apy * (YEAR_ONE_CAP_MULTIPLIERS[Math.max(1, Math.min(5, years))] ?? 1.0)).toFixed(1));

export const getRookieContract = (
  rank?: number,
): {
  years: number;
  year1CapHit: number;
} => {
  const years = 4;
  const baseValue = 12 - Math.max(0, (rank ?? 32) - 1) * 0.35;
  const year1CapHit = Number(Math.max(0.8, baseValue).toFixed(1));
  return { years, year1CapHit };
};
