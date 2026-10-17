const clamp = (v: number) => Math.max(0, Math.min(1, v));
// Abramowitz–Stegun normal CDF approximation; yardage uses continuity-corrected residual variance.
export function normalCdf(z: number) {
  const x = Math.abs(z),
    t = 1 / (1 + 0.2316419 * x);
  const tail =
    (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return clamp(z >= 0 ? 1 - tail : tail);
}
/** Discrete counts: Poisson, or negative binomial when observed variance exceeds the mean. */
export function outcomeProbability(
  mean: number,
  variance: number,
  line: number,
  side: 'OVER' | 'UNDER',
  count: boolean,
) {
  if (![mean, variance, line].every(Number.isFinite) || mean < 0 || variance < 0) return null;
  let below: number, atOrBelow: number;
  if (count && mean < 100) {
    const overdispersed = variance > mean + 0.01;
    const shape = overdispersed ? (mean * mean) / (variance - mean) : 0;
    const p = overdispersed ? shape / (shape + mean) : 0;
    const cdf = (k: number) => {
      if (k < 0) return 0;
      if (mean === 0) return 1;
      let mass = overdispersed ? Math.exp(shape * Math.log(p)) : Math.exp(-mean),
        sum = mass;
      for (let i = 1; i <= Math.min(k, 10000); i++) {
        mass *= overdispersed ? ((i - 1 + shape) / i) * (1 - p) : mean / i;
        sum += mass;
      }
      return clamp(sum);
    };
    below = cdf(Math.ceil(line) - 1);
    atOrBelow = cdf(Math.floor(line));
  } else {
    const sd = Math.sqrt(Math.max(variance, 1));
    below = normalCdf((Math.ceil(line) - 0.5 - mean) / sd);
    atOrBelow = normalCdf((Math.floor(line) + 0.5 - mean) / sd);
  }
  return { win: clamp(side === 'OVER' ? 1 - atOrBelow : below), push: clamp(atOrBelow - below) };
}
