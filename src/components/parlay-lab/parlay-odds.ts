export function americanToDecimal(odds: number) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1));
}

export function estimateParlayOdds(legs: Array<number | null | undefined>) {
  const validOdds = legs.filter((odds): odds is number => typeof odds === 'number' && odds !== 0);
  if (!legs.length || validOdds.length !== legs.length) return null;
  const decimal = validOdds.reduce((combined, odds) => combined * americanToDecimal(odds), 1);
  return decimalToAmerican(decimal);
}
