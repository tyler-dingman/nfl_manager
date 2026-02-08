export type GuaranteeBand = {
  threshold: number;
  slope: number;
};

export const GUARANTEE_BANDS: { minRating: number; band: GuaranteeBand }[] = [
  { minRating: 91, band: { threshold: 0.5, slope: 1.1 } },
  { minRating: 80, band: { threshold: 0.4, slope: 1.2 } },
  { minRating: 70, band: { threshold: 0.3, slope: 1.3 } },
];

export const DEFAULT_GUARANTEE_BAND: GuaranteeBand = {
  threshold: 0.25,
  slope: 1.1,
};

export const getGuaranteeBandForRating = (rating?: number): GuaranteeBand => {
  if (rating === undefined || Number.isNaN(rating)) {
    return DEFAULT_GUARANTEE_BAND;
  }
  for (const entry of GUARANTEE_BANDS) {
    if (rating >= entry.minRating) {
      return entry.band;
    }
  }
  return DEFAULT_GUARANTEE_BAND;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const computeGuaranteeScore = (guaranteedPct: number, rating?: number) => {
  const { threshold, slope } = getGuaranteeBandForRating(rating);
  const delta = guaranteedPct - threshold;
  return clamp(0.7 + delta * slope, 0.05, 0.95);
};
