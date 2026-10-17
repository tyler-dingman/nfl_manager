import { outcomeProbability, normalCdf } from './prop-probability';
import { bettingValue } from '../../../packages/parlay/betting-value';
import { LAB_SCORE_CONFIG as C, displayLabScore } from '../../../packages/parlay/lab-score-config';
import type { RoleContext } from '../../../packages/parlay/role-evidence';
import { expectedOpportunity } from './expected-opportunity';
import { resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const round = (v: number) => Math.round(v * 10) / 10;
export type ProjectionContext = RoleContext & {
  /** Request-local reuse across this player's lines/books; never persisted as evidence. */
  preparedOpportunity?: ReturnType<typeof expectedOpportunity>;
  debug?: boolean;
  odds?: number | null;
  matchupReliability?: number;
  spread?: number | null;
  total?: number | null;
  matchupSignal?: number | null;
  marketContext?: {
    openingLine: number | null;
    currentLine: number;
    consensusLine: number | null;
    openingOdds: number | null;
    currentOdds: number | null;
    observedAt: string | null;
  };
};
export function calculateLabScoreV2(
  games: HistoricalPlayerGame[],
  input: ProjectionContext & {
    playerId: string;
    statType: HistoricalStatType;
    line: number;
    side: 'OVER' | 'UNDER';
  },
) {
  const role = input.preparedOpportunity ?? expectedOpportunity(games, input.playerId, input);
  const rows = games
    .filter(
      (g) =>
        g.playerId === input.playerId &&
        Date.parse(g.kickoffAt ?? g.date) < Date.parse(input.asOf) &&
        resolveHistoricalStat(g, input.statType) != null,
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, C.history.limit);
  const relevantKeys =
    input.statType.startsWith('PASSING') || input.statType === 'INTERCEPTIONS'
      ? (['passingAttempts', 'snapShare'] as const)
      : input.statType.startsWith('RUSH')
        ? (['carries', 'snapShare'] as const)
        : (['targets', 'routes', 'snapShare'] as const);
  const relevance = rows.map((game) => {
    const similarities = relevantKeys.flatMap((key) => {
      const actual = game[key],
        expected = role.expected[key];
      return actual == null || expected == null
        ? []
        : [
            1 -
              Math.abs(actual - expected) /
                Math.max(
                  actual,
                  expected,
                  key === 'snapShare' ? C.roleChange.snapShareFloor : C.roleChange.minimumVolume,
                ),
          ];
    });
    if (game.depthRank != null && role.depthRank != null)
      similarities.push(1 / (1 + Math.abs(game.depthRank - role.depthRank)));
    const similarity = similarities.length
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length
      : 0;
    const days = (Date.parse(input.asOf) - Date.parse(game.date)) / 86_400_000;
    const recency = Math.max(C.history.recencyFloor, 2 ** (-days / C.history.halfLifeDays));
    return { game, similarity, weight: recency * similarity ** C.history.similarityPower };
  });
  const weightSum = relevance.reduce((s, r) => s + r.weight, 0);
  const weightedMean = (value: (g: HistoricalPlayerGame) => number | null) => {
    const valid = relevance.filter((r) => value(r.game) != null);
    const total = valid.reduce((s, r) => s + r.weight, 0);
    return total ? valid.reduce((s, r) => s + value(r.game)! * r.weight, 0) / total : null;
  };
  const production = (stat: HistoricalStatType, key: 'carries' | 'targets' | 'passingAttempts') => {
    const opportunity = role.expected[key];
    if (opportunity == null) return null;
    if (opportunity === 0) return 0;
    const valid = relevance.filter(
      (r) => r.game[key] != null && resolveHistoricalStat(r.game, stat) != null,
    );
    const units = valid.reduce((s, r) => s + r.game[key]! * r.weight, 0);
    const outcome = valid.reduce((s, r) => s + resolveHistoricalStat(r.game, stat)! * r.weight, 0);
    const priorUnits = valid.reduce((s, r) => s + r.game[key]!, 0);
    if (!priorUnits) return null;
    const priorRate =
      valid.reduce((s, r) => s + resolveHistoricalStat(r.game, stat)!, 0) / priorUnits;
    const rate =
      (outcome + priorRate * C.opportunity.efficiencyPriorUnits) /
      (units + C.opportunity.efficiencyPriorUnits);
    return opportunity * rate;
  };
  const project = (stat: HistoricalStatType): number | null => {
    if (stat === 'RUSHING_ATTEMPTS') return role.expected.carries;
    if (stat === 'PASSING_ATTEMPTS') return role.expected.passingAttempts;
    if (
      stat === 'PASSING_RUSHING_YARDS' ||
      stat === 'RUSH_RECEIVE_YARDS' ||
      stat === 'RUSHING_RECEIVING_YARDS' ||
      stat === 'ANYTIME_TD'
    ) {
      const a = project(stat === 'ANYTIME_TD' ? 'RUSHING_TDS' : 'RUSHING_YARDS');
      const b = project(
        stat === 'ANYTIME_TD'
          ? 'RECEIVING_TDS'
          : stat === 'PASSING_RUSHING_YARDS'
            ? 'PASSING_YARDS'
            : 'RECEIVING_YARDS',
      );
      return a == null || b == null ? null : a + b;
    }
    return production(
      stat,
      stat.startsWith('PASSING') || stat === 'INTERCEPTIONS'
        ? 'passingAttempts'
        : stat.startsWith('RUSHING')
          ? 'carries'
          : 'targets',
    );
  };
  const baseProjection =
    role.unquantifiedPromotion || role.unconfirmedStarterWorkload ? null : project(input.statType);
  const matchup = input.matchupSignal == null ? null : clamp(input.matchupSignal, -1, 1);
  const volumeScript = input.statType.startsWith('PASSING')
    ? 1
    : input.statType.startsWith('RUSH')
      ? -1
      : 0;
  const script =
    input.spread == null
      ? null
      : clamp(input.spread / C.adjustments.spreadScale, -1, 1) * volumeScript;
  const total =
    input.total == null
      ? null
      : clamp((input.total - C.adjustments.neutralTotal) / C.adjustments.totalScale, -1, 1);
  const environment =
    script == null && total == null
      ? null
      : (script ?? 0) * C.adjustments.spread + (total ?? 0) * C.adjustments.total;
  const projection =
    baseProjection == null
      ? null
      : Math.max(
          0,
          baseProjection * (1 + (matchup ?? 0) * C.adjustments.matchup + (environment ?? 0)),
        );
  const edge = projection == null ? null : projection - input.line;
  const recommendation =
    edge == null || Math.abs(edge) < 0.00001 || role.unavailable
      ? null
      : edge > 0
        ? 'OVER'
        : 'UNDER';
  const sign = input.side === 'OVER' ? 1 : -1;
  const avg = weightedMean((g) => resolveHistoricalStat(g, input.statType));
  const variance =
    avg == null
      ? 0
      : (weightedMean((g) => (resolveHistoricalStat(g, input.statType)! - avg) ** 2) ?? 0);
  const scale = Math.max(
    Math.sqrt(variance),
    Math.abs(projection ?? 0) * C.signals.varianceFloor,
    1,
  );
  const settled = relevance.filter(
    (r) => resolveHistoricalStat(r.game, input.statType) !== input.line,
  );
  const settledWeight = settled.reduce((s, r) => s + r.weight, 0);
  const hit = (g: HistoricalPlayerGame) =>
    sign * (resolveHistoricalStat(g, input.statType)! - input.line) > 0;
  const adjustedHitRate = settledWeight
    ? settled.reduce((s, r) => s + (hit(r.game) ? r.weight : 0), 0) / settledWeight
    : null;
  const effectiveSample = weightSum
    ? weightSum ** 2 / relevance.reduce((s, r) => s + r.weight ** 2, 0)
    : 0;
  const comparable = relevance.filter((r) => r.similarity >= C.history.comparable);
  // Missing optional context is excluded from the weighted denominator, never scored as zero.
  // Effective sample discounts dissimilar workloads instead of treating backup games as starts.
  const sampleReliability = effectiveSample / (effectiveSample + 2);
  const latestAge = rows[0]
    ? Math.max(0, (Date.parse(input.asOf) - Date.parse(rows[0].date)) / 86400000)
    : Infinity;
  const freshness = Math.exp(-Math.max(0, latestAge - 14) / 90);
  const roleReliability =
    (role.currentRoleKnown ? 1 : role.depthKnown ? 0.85 : 0.7) *
    (role.flags.conflict ? 0.5 : 1) *
    (role.flags.unresolved ? 0.7 : 1) *
    (role.flags.returning ? 0.85 : 1) *
    (role.flags.coaching ? 0.85 : 1) *
    (role.flags.committee ? 0.9 : 1);
  const reliability = sampleReliability * freshness * roleReliability;
  const count = !input.statType.includes('YARDS');
  // Add uncertainty in estimating the mean and future role to observed game variance.
  const predictiveVariance =
    Math.max(variance, count ? (projection ?? 0) : scale ** 2) *
      (1 + 1 / Math.max(effectiveSample, 1)) +
    ((projection ?? 0) * (1 - roleReliability * freshness)) ** 2;
  const probabilityMean =
    projection == null
      ? null
      : /TDS|ANYTIME_TD|INTERCEPTIONS/.test(input.statType)
        ? (projection * effectiveSample + 0.5) / (effectiveSample + 1)
        : projection;
  const unverifiedBackup =
    rows.length > 0 &&
    !role.currentRoleKnown &&
    (role.expected[role.primary] ?? 0) <
      (role.position === 'QB' ? 15 : role.position === 'RB' ? 5 : 2) &&
    input.line > (projection ?? 0) + 2 * scale;
  const distribution =
    projection == null ||
    role.unavailable ||
    unverifiedBackup ||
    effectiveSample < 3 ||
    comparable.length < 3 ||
    freshness < 0.35
      ? null
      : outcomeProbability(probabilityMean!, predictiveVariance, input.line, input.side, count);
  const probability = distribution == null ? null : distribution.win;
  const value = bettingValue(
    probability,
    distribution?.push ?? null,
    input.odds ?? input.marketContext?.currentOdds,
  );
  // Disjoint recency buckets: 45% games 1–3, 35% games 4–5, 20% games 6–10.
  const recentRows = relevance
    .slice(0, 10)
    .filter((r) => resolveHistoricalStat(r.game, input.statType) !== input.line);
  const recentWeights = recentRows.map((r) => {
    const index = relevance.indexOf(r);
    return (
      (index < 3 ? 0.45 / 3 : index < 5 ? 0.35 / 2 : 0.2 / 5) *
      r.similarity ** C.history.similarityPower
    );
  });
  const recentTotal = recentWeights.reduce((a, b) => a + b, 0);
  const recentRate = recentTotal
    ? recentRows.reduce((sum, r, i) => sum + Number(hit(r.game)) * recentWeights[i]!, 0) /
      recentTotal
    : null;
  const recentEffective = recentTotal
    ? recentTotal ** 2 / recentWeights.reduce((sum, w) => sum + w * w, 0)
    : 0;
  const smoothedRecent =
    recentRate == null ? null : (recentRate * recentEffective + 0.5) / (recentEffective + 1);
  const smoothedHistory =
    adjustedHitRate == null
      ? null
      : (adjustedHitRate * effectiveSample + 0.5) / (effectiveSample + 1);
  const consistency =
    projection == null ? null : 1 / (1 + Math.sqrt(variance) / Math.max(Math.abs(projection), 1));
  const usageKey =
    input.statType.startsWith('PASSING') || input.statType === 'INTERCEPTIONS'
      ? 'passingAttempts'
      : input.statType.startsWith('RUSH')
        ? 'carries'
        : 'targets';
  const usageRows = relevance.filter((r) => r.game[usageKey] != null);
  const expectedWork = role.expected[usageKey];
  const workVariance =
    expectedWork == null || !usageRows.length
      ? null
      : usageRows.reduce((sum, r) => sum + (r.game[usageKey]! - expectedWork) ** 2, 0) /
        usageRows.length;
  const efficiency = expectedWork && baseProjection != null ? baseProjection / expectedWork : null;
  const requiredWork = efficiency && efficiency > 0 ? input.line / efficiency : null;
  const usageSupport =
    requiredWork == null || expectedWork == null || workVariance == null
      ? null
      : normalCdf(
          (sign * (expectedWork - requiredWork)) /
            Math.sqrt(Math.max(workVariance, expectedWork, 1)),
        );
  const components = {
    edge:
      distribution == null
        ? null
        : (100 * distribution.win) / Math.max(1 - distribution.push, 0.001),
    recent: smoothedRecent == null ? null : 100 * smoothedRecent,
    matchup:
      matchup == null
        ? null
        : 100 * clamp(0.5 + ((sign * matchup) / 2) * (input.matchupReliability ?? 1)),
    opportunity:
      usageSupport == null
        ? null
        : 100 *
          clamp(
            0.8 * usageSupport +
              0.2 * (role.changeRatio == null ? 0.5 : clamp(0.5 + (sign * role.changeRatio) / 2)),
          ),
    history:
      smoothedHistory == null ? null : 100 * smoothedHistory * (0.8 + 0.2 * (consistency ?? 0)),
    environment:
      environment == null
        ? null
        : 100 *
          clamp(0.5 + (sign * environment) / (2 * (C.adjustments.spread + C.adjustments.total))),
  };
  const availableWeight = Object.entries(C.weights).reduce(
    (sum, [key, w]) => sum + (components[key as keyof typeof components] == null ? 0 : w),
    0,
  );
  const rawScore = availableWeight
    ? Object.entries(C.weights).reduce(
        (sum, [key, w]) => sum + (components[key as keyof typeof components] ?? 0) * w,
        0,
      ) / availableWeight
    : 0;
  // Smooth evidence shrinkage, not tier caps. Strong scores need strong, current evidence.
  const scoreReliability = Math.sqrt(sampleReliability) * roleReliability * freshness;
  const modelScore =
    distribution == null ? 0 : Math.round(clamp(50 + (rawScore - 50) * scoreReliability, 0, 99));
  const supportingGroups = Object.values(components).filter((v) => v != null && v >= 65).length;
  const caps: string[] = []; // Retained for older API clients; there are no arbitrary tier caps.
  const cap = 99;
  const penalties = round(rawScore - modelScore);
  return {
    version: C.version,
    score: displayLabScore(modelScore, distribution != null),
    modelScore,
    projection: projection == null ? null : round(projection),
    baseProjection,
    line: input.line,
    edge: edge == null ? null : round(edge),
    recommendation,
    side: input.side,
    asOf: input.asOf,
    expectedOpportunity: role.expected,
    roleConfidence: role.roleConfidence,
    roleChange: role.roleChange,
    role: role.depthRank
      ? `${role.position ?? 'Player'} · depth rank ${role.depthRank}`
      : 'Recent usage estimate; current depth unconfirmed',
    recentUsage: { metric: role.primary, lastGame: role.lastUsage, trend: role.changeRatio },
    matchup:
      matchup == null
        ? 'Unavailable'
        : matchup > 0.1
          ? 'Favors production'
          : matchup < -0.1
            ? 'Limits production'
            : 'Neutral',
    rawL10: {
      games: rows.slice(0, 10).length,
      hits: rows.slice(0, 10).filter(hit).length,
      pushes: rows
        .slice(0, 10)
        .filter((g) => resolveHistoricalStat(g, input.statType) === input.line).length,
    },
    roleAdjusted: {
      hitRate: adjustedHitRate == null ? null : round(adjustedHitRate * 100),
      effectiveSample: round(effectiveSample),
      games: comparable.length,
      hits: comparable.filter((r) => hit(r.game)).length,
    },
    reasons: [
      ...(unverifiedBackup
        ? [
            'Backup usage is inconsistent with the offered line; current role confirmation is required.',
          ]
        : []),
      ...(distribution == null
        ? ['Insufficient current comparable data for a credible hit probability.']
        : []),
      ...(smoothedRecent == null
        ? []
        : [
            `${recentRows.filter((r) => hit(r.game)).length}/${recentRows.length} recent games cleared the selected side; recent workload receives more weight.`,
          ]),
      ...role.reasons,
      ...(recommendation
        ? [
            `Opportunity-based projection is ${round(Math.abs(edge!))} ${edge! > 0 ? 'above' : 'below'} the line.`,
          ]
        : ['No actionable projection.']),
    ].slice(0, 4),
    components,
    componentWeights: C.weights,
    rawScore: round(rawScore),
    estimatedProbability: probability,
    pushProbability: distribution?.push ?? null,
    probabilityMethod: count
      ? 'Poisson / negative binomial'
      : 'Variance-based normal with continuity correction',
    probabilityCalibrated: false,
    bettingValue: value,
    dataQuality: {
      completeness: round(availableWeight * 100),
      reliability,
      freshness,
      latestUsageAt: rows[0]?.date ?? null,
      currentRoleKnown: role.currentRoleKnown,
      effectiveSample: round(effectiveSample),
    },
    supportingGroups,
    penalties,
    cap,
    caps,
    sources: role.sources,
    missingOpportunity: role.missing,
    marketContext: input.marketContext ?? null,
    historicalRelevance: input.debug
      ? relevance.map((r) => ({
          gameId: r.game.gameId,
          date: r.game.date,
          similarity: r.similarity,
          weight: r.weight,
        }))
      : [],
  };
}
export type LabScoreV2 = ReturnType<typeof calculateLabScoreV2>;
