import type { HomeMarket } from './research';
import { matchesDiscoveryMode } from './discovery-selection';
import { decimalOdds } from './betting-value';

export const RELATIVE_SCORE_VERSION = 'slate-percentile-v1';
/** A pick is independent of sportsbook; adding another price cannot change the cohort. */
export const relativePickKey = (m: HomeMarket) =>
  JSON.stringify([m.eventId, m.playerId, m.marketType, m.period, m.side, m.line]);
const evidenceScore = (m: HomeMarket) => m.trend?.projection?.modelScore ?? m.trend?.trendScore;
function evidenceBacked(m: HomeMarket) {
  const score = evidenceScore(m);
  return (
    !!m.trend?.projection &&
    m.trend.projection.estimatedProbability != null &&
    score != null &&
    Number.isFinite(score) &&
    score > 0
  );
}
function supported(m: HomeMarket) {
  return (
    evidenceBacked(m) &&
    (matchesDiscoveryMode(m, { altLines: false, maxOdds: -1000 }) ||
      matchesDiscoveryMode(m, { altLines: true, maxOdds: -1000 }))
  );
}

/** Rank the entire upcoming slate before UI filtering or pagination. Stable pick
 * identity breaks evidence-score ties. Exactly ceil(10% * N) distinct supported
 * picks occupy 90–97; remaining picks span 1–89. This is never hit probability. */
export function relativePropScores(markets: HomeMarket[]) {
  const picks = new Map<string, HomeMarket>();
  for (const m of markets) {
    if (!supported(m)) continue;
    const key = relativePickKey(m),
      old = picks.get(key);
    if (
      !old ||
      (decimalOdds(m.odds) ?? 0) > (decimalOdds(old.odds) ?? 0) ||
      (m.odds === old.odds && m.sportsbook.localeCompare(old.sportsbook) < 0)
    )
      picks.set(key, m);
  }
  const ranked = [...picks].sort(
    ([ak, a], [bk, b]) => evidenceScore(b)! - evidenceScore(a)! || ak.localeCompare(bk),
  );
  const topCount = Math.ceil(ranked.length / 10),
    rest = ranked.length - topCount;
  const scores = new Map(
    ranked.map(([key], i) => [
      key,
      i < topCount
        ? 97 - Math.floor((7 * i) / Math.max(1, topCount - 1))
        : 89 - Math.floor((88 * (i - topCount)) / Math.max(1, rest - 1)),
    ]),
  );
  return { scores, population: ranked.length, topCount, version: RELATIVE_SCORE_VERSION };
}
export function applyRelativePropScores(markets: HomeMarket[]) {
  const scale = relativePropScores(markets);
  return {
    markets: markets.map((m) => {
      const score = evidenceBacked(m) ? scale.scores.get(relativePickKey(m)) : undefined;
      if (score == null || !m.trend?.projection) return m;
      return {
        ...m,
        trend: { ...m.trend, trendScore: score, projection: { ...m.trend.projection, score } },
      };
    }),
    scoreScale: { version: scale.version, population: scale.population, topCount: scale.topCount },
  };
}
