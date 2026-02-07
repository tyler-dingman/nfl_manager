export const formatCapMillions = (amountDollars: number): string => {
  const value = Math.abs(amountDollars) / 1_000_000;
  const formatted = value.toFixed(1);
  return amountDollars < 0 ? `-$${formatted}M` : `$${formatted}M`;
};

export const ordinal = (value: number): string => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

export const computeCapRank = (
  teamAbbr: string,
  caps: Array<{ teamAbbr: string; capSpace: number }>,
): number => {
  const sorted = [...caps].sort((a, b) => b.capSpace - a.capSpace);
  const index = sorted.findIndex((entry) => entry.teamAbbr === teamAbbr);
  return index >= 0 ? index + 1 : sorted.length + 1;
};
