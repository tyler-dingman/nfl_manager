// Display tiers, not probabilities. The underlying weighted trend formula is unchanged.
export const LAB_SCORE_TIERS = [
  {
    min: 90,
    label: 'HIGH',
    range: '90–100',
    description: 'High alignment among the available trend signals.',
  },
  {
    min: 70,
    label: 'GOOD',
    range: '70–89',
    description: 'Generally supportive historical trend signals.',
  },
  { min: 50, label: 'MODERATE', range: '50–69', description: 'Mixed historical trend signals.' },
  {
    min: 0,
    label: 'LOW',
    range: '0–49',
    description: 'Lower alignment among the available signals.',
  },
] as const;
export const labScoreTier = (score: number) =>
  LAB_SCORE_TIERS.find((tier) => score >= tier.min) ?? LAB_SCORE_TIERS[3];
export const LAB_SCORE_EXPLANATION =
  'Lab Score measures research-signal alignment, not win probability or betting value. Recent history and line cushion are moderated by consistency and sample size. Matchup, usage and stored game-script context are evaluated for the selected Over or Under. Unknown context has no adjustment. Known alternate lines use the same-book main threshold for scoring, while displayed hit rates still describe the selected line.';
type Trend = {
  streakType: string | null;
  streakLength: number;
  last10: { hits: number; games: number };
  recentAverage10: number | null;
};
export function trendReason(market: { trend?: Trend | null; line: number | null; side: string }) {
  const t = market.trend;
  if (!t || t.last10.games < 5)
    return {
      title: 'Insufficient history',
      detail: 'At least 5 qualifying games needed',
      streak: false,
    };
  const streak = t.streakType === 'HIT' && t.streakLength >= 5;
  const under = market.side === 'UNDER';
  const margin =
    t.recentAverage10 == null || market.line == null
      ? null
      : under
        ? market.line - t.recentAverage10
        : t.recentAverage10 - market.line;
  return {
    streak,
    title: streak
      ? `${t.streakLength} straight ${under ? 'under' : 'over'}`
      : `${t.last10.hits} of last ${t.last10.games}`,
    detail:
      margin == null
        ? 'Historical performance'
        : `${margin >= 0 ? '+' : ''}${Number(margin.toFixed(1))} avg ${under ? 'below' : 'over'} line · L10`,
  };
}
export function representativeTrends<
  T extends {
    eventId?: string;
    playerId?: string | null;
    marketType: string;
    period?: string;
    side: string;
    lineType?: string;
    trend?: { trendScore: number } | null;
  },
>(markets: T[]) {
  const groups = new Map<string, T>();
  for (const market of markets) {
    const key = [
      market.eventId,
      market.playerId,
      market.marketType,
      market.period,
      market.side,
    ].join('|');
    const old = groups.get(key);
    if (!old) {
      groups.set(key, market);
      continue;
    }
    const value = (m: T) => (m.trend?.trendScore ?? -1) + (m.lineType === 'main' ? 5 : 0);
    if (value(market) > value(old)) groups.set(key, market);
  }
  return [...groups.values()];
}

/** Compact wording for table rows; detailed reasons remain in research. */
export function compactTrendReason(market: {
  trend?: Trend | null;
  line: number | null;
  side: string;
}) {
  const reason = trendReason(market);
  const trend = market.trend;
  if (!trend || trend.last10.games < 5) return 'Insufficient history';
  const title = reason.streak
    ? `${trend.streakLength} straight ${market.side === 'UNDER' ? 'U' : 'O'}`
    : reason.title;
  if (trend.recentAverage10 == null || market.line == null) return title;
  const margin = trend.recentAverage10 - market.line;
  const amount = Number(Math.abs(margin).toFixed(1));
  return `${title} · ${amount} ${margin < 0 ? 'below' : 'above'} line`;
}
