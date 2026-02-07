const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export type RenegotiateScoreInput = {
  age: number;
  rating: number;
  yearsRemaining: number;
  currentApy: number;
  currentGuaranteed: number;
  years: number;
  apy: number;
  guaranteed: number;
  seed?: string;
};

const jitterFromSeed = (seed?: string) => {
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 9) - 4;
  return normalized;
};

export const estimateRenegotiateScore = (input: RenegotiateScoreInput) => {
  const {
    age,
    rating,
    yearsRemaining,
    currentApy,
    currentGuaranteed,
    years,
    apy,
    guaranteed,
    seed,
  } = input;

  const currentTotal = currentApy * yearsRemaining;
  const newTotal = apy * years;
  const guaranteedPct = newTotal > 0 ? guaranteed / newTotal : 0;
  const targetPct = age >= 30 ? 0.35 : age >= 27 ? 0.45 : 0.55;

  if (newTotal < currentTotal * 0.9 || guaranteed < currentGuaranteed * 0.8) {
    return {
      score: 30,
      label: 'Not close',
      insult: true,
    };
  }

  const moneyRatio = currentTotal > 0 ? newTotal / currentTotal : 1.1;
  let moneyScore = 0;
  if (moneyRatio >= 1.2) moneyScore = 50;
  else if (moneyRatio >= 1.1) moneyScore = 45;
  else if (moneyRatio >= 1.0) moneyScore = 38;
  else if (moneyRatio >= 0.95) moneyScore = 28;
  else if (moneyRatio >= 0.9) moneyScore = 18;
  else moneyScore = 8;

  const preferredMax = age >= 30 ? 2 : age >= 27 ? 3 : 4;
  const yearsScore = years <= preferredMax ? 20 : 8;

  let guaranteedScore = 0;
  if (guaranteedPct >= targetPct) guaranteedScore = 20;
  else if (guaranteedPct >= targetPct - 0.1) guaranteedScore = 12;
  else guaranteedScore = 4;

  const yearsPenalty = yearsRemaining >= 3 ? -10 : yearsRemaining === 2 ? -4 : 0;
  const ratingBonus = rating >= 90 ? 4 : rating >= 80 ? 2 : 0;

  const baseScore = moneyScore + yearsScore + guaranteedScore + yearsPenalty + ratingBonus;
  const score = clamp(baseScore + jitterFromSeed(seed));

  const label =
    score >= 90 ? 'Very likely' : score >= 75 ? 'Likely' : score >= 55 ? 'Maybe' : 'Not close';

  return {
    score,
    label,
    insult: false,
  };
};
