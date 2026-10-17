import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
import type { LabScoreV2 } from '@/server/historical-stats/lab-score-v2';
// Display tiers, not probabilities. Legacy tiers remain during the shadow rollout.
export const LAB_SCORE_TIERS = [
  {
    min: 90,
    label: 'HIGH',
    range: '90–100',
    description: 'Strong trend alignment.',
  },
  {
    min: 70,
    label: 'GOOD',
    range: '70–89',
    description: 'Supportive trend alignment.',
  },
  { min: 50, label: 'MODERATE', range: '50–69', description: 'Mixed trend signals.' },
  {
    min: 0,
    label: 'LOW',
    range: '0–49',
    description: 'Limited trend alignment.',
  },
] as const;
export const labScoreTier = (score: number, version?: string) =>
  (version === 'legacy' ? LAB_SCORE_TIERS : LAB_SCORE_CONFIG.bands).find(
    (tier) => score >= tier.min,
  ) ?? LAB_SCORE_TIERS[3];
export const LAB_SCORE_V2_EXPLANATION =
  'Lab Score 2.0 combines projection edge (25%), recent performance (25%), matchup (20%), opportunity (15%), consistency (10%), and game environment (5%). Missing optional inputs are reweighted; evidence quality moderates confidence. Lab Score is not a win probability. Trending also evaluates offered odds and estimated betting value.';
export const LAB_SCORE_EXPLANATION = LAB_SCORE_V2_EXPLANATION;
type Trend = {
  projection?: LabScoreV2;
  scoreVersion?: 'legacy' | 'v2';
  streakType: string | null;
  streakLength: number;
  last10: { hits: number; games: number };
  recentAverage10: number | null;
};
export function trendReason(market: { trend?: Trend | null; line: number | null; side: string }) {
  const t = market.trend;
  if (t?.scoreVersion === 'v2' && t.projection) {
    const p = t.projection;
    return {
      title:
        p.projection == null
          ? 'Projection unavailable'
          : `${p.projection} projected · ${p.recommendation ?? 'No edge'}`,
      detail: `Role confidence ${p.roleConfidence.toLowerCase()} · ${p.reasons[0] ?? 'Limited evidence'}`,
      streak: false,
    };
  }
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
export { representativeTrends } from '../../../packages/parlay/trending-selection';

/** Compact wording for table rows; detailed reasons remain in research. */
export function compactTrendReason(market: {
  trend?: Trend | null;
  line: number | null;
  side: string;
}) {
  const reason = trendReason(market);
  if (market.trend?.scoreVersion === 'v2') return reason.title;
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
