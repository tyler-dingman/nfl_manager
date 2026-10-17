import { isTrendingEligible } from '../../../packages/parlay/trending-selection';
import { decimalOdds } from '../../../packages/parlay/betting-value';
import type { LabScoreV2 } from './lab-score-v2';
import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
export type ScoredAuditRow = {
  eventId: string;
  playerId: string;
  position: string;
  playerName?: string;
  odds?: number;
  sportsbook?: string;
  statType: string;
  side: 'OVER' | 'UNDER';
  legacyScore: number;
  projection: LabScoreV2;
  outcome: 'WIN' | 'LOSS' | 'PUSH' | null;
};
export function summarizeScoreAudit(rows: ScoredAuditRow[]) {
  const stats = (items: { score: number; outcome: ScoredAuditRow['outcome'] }[]) => {
    const settled = items.filter((r) => r.outcome === 'WIN' || r.outcome === 'LOSS');
    return {
      count: items.length,
      averageScore: items.length ? items.reduce((s, r) => s + r.score, 0) / items.length : null,
      score80Plus: items.filter((r) => r.score >= 80).length,
      score90Plus: items.filter((r) => r.score >= 90).length,
      settled: settled.length,
      pushes: items.filter((r) => r.outcome === 'PUSH').length,
      accuracy: settled.length
        ? settled.filter((r) => r.outcome === 'WIN').length / settled.length
        : null,
    };
  };
  const model = (version: 'legacy' | 'v2') => {
    const scored = rows.map((r) => ({
      ...r,
      score: version === 'legacy' ? r.legacyScore : r.projection.score,
    }));
    const chosen = new Map<string, (typeof scored)[number]>();
    for (const r of scored) {
      if (version === 'v2' && r.projection.recommendation !== r.side) continue;
      const key = [r.eventId, r.playerId, r.statType].join('|');
      if (!chosen.has(key) || chosen.get(key)!.score < r.score) chosen.set(key, r);
    }
    const picks = [...chosen.values()];
    const group = (key: (r: (typeof scored)[number]) => string) =>
      Object.fromEntries(
        [...new Set(picks.map(key))]
          .sort()
          .map((value) => [value, stats(picks.filter((r) => key(r) === value))]),
      );
    return {
      offers: stats(scored),
      recommendations: stats(picks),
      actionable: stats(picks.filter((r) => r.score >= 70)),
      direction: Object.fromEntries(
        (['OVER', 'UNDER'] as const).map((side) => [
          side,
          {
            ...stats(picks.filter((r) => r.side === side)),
            percentage: picks.length
              ? (picks.filter((r) => r.side === side).length / picks.length) * 100
              : 0,
          },
        ]),
      ),
      bySlate: Object.fromEntries(
        [...new Set(picks.map((r) => r.eventId))].map((eventId) => [
          eventId,
          {
            ...stats(picks.filter((r) => r.eventId === eventId)),
            direction: Object.fromEntries(
              (['OVER', 'UNDER'] as const).map((side) => [
                side,
                stats(picks.filter((r) => r.eventId === eventId && r.side === side)),
              ]),
            ),
          },
        ]),
      ),
      byPosition: group((r) => r.position),
      byProp: group((r) => r.statType),
      byRoleChange: group((r) => r.projection.roleChange.severity),
      byScoreBucket: Object.fromEntries(
        LAB_SCORE_CONFIG.bands.map((band) => [
          band.range,
          stats(
            picks.filter(
              (r) => LAB_SCORE_CONFIG.bands.find((b) => r.score >= b.min)?.min === band.min,
            ),
          ),
        ]),
      ),
      byOfferDirection: Object.fromEntries(
        (['OVER', 'UNDER'] as const).map((side) => [
          side,
          stats(scored.filter((r) => r.side === side)),
        ]),
      ),
    };
  };
  // One offer per event/player/stat/side/line/book avoids repeated snapshots; correlated offers
  // remain correlated and must not be interpreted as independent calibration trials.
  const uniqueOffers = new Map<string, ScoredAuditRow>();
  for (const r of rows) {
    const key = [r.eventId, r.playerId, r.statType, r.side, r.projection.line].join('|');
    const old = uniqueOffers.get(key);
    if (!old || (decimalOdds(r.odds) ?? 0) > (decimalOdds(old.odds) ?? 0)) uniqueOffers.set(key, r);
  }
  const settled = [...uniqueOffers.values()].filter((r) => r.outcome != null);
  const credible = settled.filter((r) => r.projection.estimatedProbability != null);
  const probability = (r: ScoredAuditRow) =>
    r.projection.estimatedProbability! / (1 - (r.projection.pushProbability ?? 0));
  const metrics = (group: ScoredAuditRow[]) => {
    const decisive = group.filter((r) => r.outcome !== 'PUSH');
    const priced = group.filter((r) => decimalOdds(r.odds) != null);
    const returns = priced.map((r) =>
      r.outcome === 'PUSH' ? 0 : r.outcome === 'WIN' ? decimalOdds(r.odds)! - 1 : -1,
    );
    return {
      count: group.length,
      hitRate: decisive.length
        ? decisive.filter((r) => r.outcome === 'WIN').length / decisive.length
        : null,
      pushes: group.filter((r) => r.outcome === 'PUSH').length,
      meanEstimatedProbability: decisive.length
        ? decisive.reduce((s, r) => s + probability(r), 0) / decisive.length
        : null,
      brier: decisive.length
        ? decisive.reduce((s, r) => s + (probability(r) - Number(r.outcome === 'WIN')) ** 2, 0) /
          decisive.length
        : null,
      priced: priced.length,
      realizedReturn: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
      estimatedReturn: priced.length
        ? priced.reduce((s, r) => s + (r.projection.bettingValue.expectedReturn ?? 0), 0) /
          priced.length
        : null,
    };
  };
  return {
    legacy: model('legacy'),
    v2: model('v2'),
    validation: {
      status: 'Diagnostic only; independent multi-week holdout calibration still required',
      independentEvents: new Set(credible.map((r) => r.eventId)).size,
      slates: new Set(credible.map((r) => r.projection.asOf.slice(0, 10))).size,
      settledOffers: settled.length,
      ...metrics(credible),
      byProbability: Object.fromEntries(
        [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((lo) => [
          `${Math.round(lo * 100)}–${Math.round((lo + 0.1) * 100)}`,
          metrics(
            credible.filter(
              (r) =>
                probability(r) >= lo &&
                (lo === 0.9 ? probability(r) <= 1 : probability(r) < lo + 0.1),
            ),
          ),
        ]),
      ),
      byScore: Object.fromEntries(
        LAB_SCORE_CONFIG.bands.map((b) => [
          b.range,
          metrics(
            credible.filter(
              (r) => LAB_SCORE_CONFIG.bands.find((t) => r.projection.score >= t.min)?.min === b.min,
            ),
          ),
        ]),
      ),
      trending: metrics(
        credible.filter((r) =>
          isTrendingEligible({
            side: r.side,
            odds: r.odds,
            trend: { trendScore: r.projection.score, projection: r.projection },
          }),
        ),
      ),
      byMarket: Object.fromEntries(
        [...new Set(credible.map((r) => r.statType))].map((stat) => [
          stat,
          metrics(credible.filter((r) => r.statType === stat)),
        ]),
      ),
      smallSamples: metrics(credible.filter((r) => r.projection.roleAdjusted.effectiveSample < 5)),
      extremePrices: metrics(credible.filter((r) => (r.odds ?? 0) < -1000)),
    },
  };
}
