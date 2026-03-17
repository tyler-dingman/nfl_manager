const MIN_PLAYER_RATING = 40;
const MAX_PLAYER_RATING = 99;

export const generateBaselinePlayerRating = (): number => 75;

export const blendPlayerRating = (baselineRating: number, maddenRating?: number | null): number => {
  if (maddenRating === null || maddenRating === undefined || Number.isNaN(maddenRating)) {
    return clampRating(baselineRating);
  }

  return clampRating(Math.ceil(baselineRating + (maddenRating - baselineRating) / 2));
};

const clampRating = (value: number): number =>
  Math.max(MIN_PLAYER_RATING, Math.min(MAX_PLAYER_RATING, value));
