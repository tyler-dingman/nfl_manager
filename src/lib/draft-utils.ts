export const getPickValue = (overall: number): number => {
  const adjusted = Math.max(1, overall);
  const value = 3000 / Math.pow(adjusted + 5, 0.85);
  return Math.round(value);
};

export const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const getTradeAcceptance = (
  sendValue: number,
  receiveValue: number,
): number => {
  if (sendValue === 0 && receiveValue === 0) {
    return 50;
  }

  if (sendValue === 0) {
    return 100;
  }

  const diff = receiveValue - sendValue;
  const normalized = diff / sendValue;
  return clampNumber(Math.round(50 + normalized * 50), 0, 100);
};

export const getDraftGrade = (rankValues: number[]): string => {
  if (rankValues.length === 0) {
    return 'C';
  }

  const average =
    rankValues.reduce((total, value) => total + value, 0) / rankValues.length;
  const score = clampNumber(100 - average, 0, 100);

  if (score >= 92) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 83) return 'A-';
  if (score >= 78) return 'B+';
  if (score >= 72) return 'B';
  if (score >= 66) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 54) return 'C';
  if (score >= 48) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
};
