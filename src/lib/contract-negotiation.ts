export type NegotiationTone = 'negative' | 'neutral' | 'positive';

export const MAX_LOGIC_APY = 60;

export const POSITION_APY_CAPS: Record<string, number> = {
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
  HB: 20,
  FB: 20,
  DE: 40,
  OLB: 40,
  ILB: 22,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (normalized === 'EDGE' || normalized === 'ED' || normalized === 'DE') return 'EDGE';
  if (normalized === 'FS' || normalized === 'SS') return 'S';
  if (normalized === 'HB' || normalized === 'FB') return 'RB';
  if (normalized === 'OT' || normalized === 'T') return 'LT';
  if (normalized === 'G') return 'LG';
  if (normalized === 'IDL' || normalized === 'DL') return 'DT';
  return normalized;
};

export const getApyCapForPosition = (position: string) =>
  POSITION_APY_CAPS[normalizePosition(position)] ?? 25;

export const clampOfferYears = (years: number, maxYears = 5) =>
  clamp(Math.round(years), 1, maxYears);

const jitterFromSeed = (seed?: string) => {
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 7) - 3;
  return normalized / 100;
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
    case 6:
      return 0.2;
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

export const evaluateContractOffer = ({
  marketApy,
  offeredApy,
  years,
  guaranteed,
  position,
  maxYears = 5,
  seed,
}: {
  marketApy: number;
  offeredApy: number;
  years: number;
  guaranteed: number;
  position: string;
  maxYears?: number;
  seed?: string;
}) => {
  const clampedYears = clampOfferYears(years, maxYears);
  const cap = Math.min(getApyCapForPosition(position), MAX_LOGIC_APY);
  const effectiveApy = Math.min(offeredApy, cap);
  const safeMarketApy = marketApy > 0 ? marketApy : cap;
  const ratio = safeMarketApy > 0 ? effectiveApy / safeMarketApy : 0;
  const guaranteedPct =
    offeredApy > 0 && clampedYears > 0 ? clamp(guaranteed / (offeredApy * clampedYears), 0, 1) : 0;

  const baseProbability = baseFromRatio(ratio);
  const yearsBonus = getYearsBonus(clampedYears);
  const guaranteeBonus = clamp(0.2 * (guaranteedPct - 0.25), 0, 0.15);
  const synergy =
    clampedYears > 2 && guaranteedPct >= 0.55
      ? (clampedYears - 2) * (guaranteedPct - 0.55) * 0.1
      : 0;
  const jitter = jitterFromSeed(seed);

  const probability = clamp(
    baseProbability + yearsBonus + guaranteeBonus + synergy + jitter,
    0.05,
    0.9,
  );
  const score = Math.round(probability * 100);
  const tone: NegotiationTone = score >= 75 ? 'positive' : score >= 55 ? 'neutral' : 'negative';

  return {
    probability,
    score,
    tone,
    clampedYears,
    effectiveApy,
    guaranteedPct,
    ratio,
    yearsBonus,
    guaranteeBonus,
  };
};
