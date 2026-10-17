export function decimalOdds(odds: number | null | undefined): number | null {
  return odds == null || !Number.isFinite(odds) || Math.abs(odds) < 100
    ? null
    : odds > 0
      ? 1 + odds / 100
      : 1 + 100 / Math.abs(odds);
}
/** Probabilities are unconditional; pushes return the stake. No vig-removal claim. */
export function bettingValue(
  probability: number | null,
  pushProbability: number | null,
  odds: number | null | undefined,
) {
  const decimal = decimalOdds(odds);
  const push = pushProbability ?? 0;
  const valid =
    probability != null &&
    Number.isFinite(probability) &&
    probability >= 0 &&
    probability + push <= 1.000001;
  return {
    impliedProbability: decimal == null ? null : 1 / decimal,
    expectedReturn: !valid || decimal == null ? null : probability! * decimal + push - 1,
    probabilityEdge:
      !valid || decimal == null || push >= 1 ? null : probability! / (1 - push) - 1 / decimal,
    extremePrice: odds != null && odds < -1000,
  };
}
