import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLabScoreV2 } from './lab-score-v2';
import { expectedOpportunity } from './expected-opportunity';
import { calculatePlayerPropTrend } from './trend-service';
import { summarizeScoreAudit } from './score-audit';
import { parseDepthEvidence, parseInjuryEvidence, roleObservationSchema } from './role-ingestion';
import { LAB_SCORE_CONFIG as C } from '../../../packages/parlay/lab-score-config';
import type { RoleObservation } from '../../../packages/parlay/role-evidence';
import type { HistoricalPlayerGame } from './types';

const asOf = '2026-10-03T12:00:00Z';
const games = (carries: number[], id = 'p', yardsPerCarry = 4): HistoricalPlayerGame[] =>
  carries.map((value, i) => ({
    gameId: String(i),
    date: new Date(Date.parse(asOf) - (i * 7 + 5) * 86400000).toISOString(),
    season: 2026,
    week: 10 - i,
    seasonType: 'REG',
    playerId: id,
    playerName: id,
    position: 'RB',
    teamId: 'KC',
    opponentTeamId: 'LV',
    homeAway: 'HOME',
    carries: value,
    rushingYards: value * yardsPerCarry,
    rushingTds: 0,
    targets: 3,
    receptions: 2,
    receivingYards: 15,
    receivingTds: 0,
    passingAttempts: 0,
    passingCompletions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
  }));
const evidence = (overrides: Partial<RoleObservation> = {}): RoleObservation => ({
  playerId: 'p',
  teamId: 'KC',
  position: 'RB',
  source: 'official',
  kind: 'official_injury',
  sourceAt: '2026-10-02T12:00:00Z',
  receivedAt: '2026-10-02T12:01:00Z',
  status: 'AVAILABLE',
  ...overrides,
});
const input = {
  playerId: 'p',
  statType: 'RUSHING_YARDS' as const,
  line: 52.5,
  side: 'OVER' as const,
  asOf,
  teamId: 'KC',
  debug: true,
};
const established = {
  coverageAt: '2026-10-02T12:00:00Z',
  observations: [evidence(), evidence({ kind: 'depth', depthRank: 1 })],
};

test('weights sum to one and historical evidence is limited to ten percent', () => {
  assert.equal(
    Object.values(C.weights).reduce((a, b) => a + b, 0),
    1,
  );
  assert.equal(C.weights.history, 0.1);
});
test('10/10 unders cannot create elite confidence without current role evidence', () => {
  const result = calculateLabScoreV2(games(Array(10).fill(3)), { ...input, side: 'UNDER' });
  assert.equal(result.rawL10.hits, 10);
  assert.equal(result.roleConfidence, 'LOW');
  assert.ok(result.modelScore < 80);
  assert.ok(result.dataQuality.reliability < 0.7);
});
test('higher upcoming workload changes projection despite ten historical unders', () => {
  const history = games(Array(10).fill(3));
  const p = calculateLabScoreV2(history, {
    ...input,
    ...established,
    observations: [
      ...established.observations,
      evidence({ kind: 'report', expected: { carries: 17 }, change: 'PROMOTED' }),
    ],
  });
  assert.equal(p.projection, 68);
  assert.equal(p.recommendation, 'OVER');
  assert.equal(p.rawL10.hits, 0);
  assert.equal(p.roleChange.severity, 'MAJOR');
  assert.equal(p.roleAdjusted.games, 0);
});
test('uncertainty lowers confidence without altering projection or reversing direction', () => {
  const history = games(Array(10).fill(17));
  const high = calculateLabScoreV2(history, { ...input, ...established });
  const low = calculateLabScoreV2(history, input);
  assert.equal(low.projection, high.projection);
  assert.equal(low.recommendation, high.recommendation);
  assert.ok(low.score < high.score);
});
test('old comparable workload outweighs the latest dissimilar role', () => {
  const p = calculateLabScoreV2(games([3, 3, 3, 17, 17, 17, 17]), {
    ...input,
    ...established,
    observations: [...established.observations, evidence({ expected: { carries: 17 } })],
  });
  assert.ok(p.historicalRelevance[3]!.weight > p.historicalRelevance[0]!.weight);
});
test('vacated workload is distributed, not assigned in full, and not counted twice when already absent', () => {
  const history = [
    ...games(Array(10).fill(6)),
    ...games(Array(10).fill(4), 'other'),
    ...games(Array(10).fill(18), 'starter'),
  ];
  const observations = [
    ...established.observations,
    evidence({ playerId: 'starter', status: 'OUT', playerName: 'Starter' }),
  ];
  const context = { asOf, teamId: 'KC', ...established, observations };
  const own = expectedOpportunity(history, 'p', context),
    other = expectedOpportunity(history, 'other', context);
  assert.ok(own.expected.carries! > 6);
  assert.ok(
    own.vacated.carries + other.vacated.carries <= 18 * C.opportunity.redistribution + 0.0001,
  );
  const alreadyAbsent = history.filter((g) => !(g.playerId === 'starter' && Number(g.gameId) < 3));
  assert.equal(expectedOpportunity(alreadyAbsent, 'p', context).vacated.carries, 0);
});
test('new available status supersedes old OUT; future and late-arriving reports cannot leak', () => {
  const history = games(Array(10).fill(17));
  const p = calculateLabScoreV2(history, {
    ...input,
    ...established,
    observations: [
      ...established.observations,
      evidence({ status: 'OUT', sourceAt: '2026-09-01T12:00:00Z' }),
      evidence({ status: 'OUT', sourceAt: '2026-10-04T12:00:00Z' }),
      evidence({ expected: { carries: 0 }, receivedAt: '2026-10-04T12:00:00Z' }),
    ],
  });
  assert.equal(p.roleConfidence, 'HIGH');
  assert.equal(p.projection, 68);
});
test('conflicting availability lowers confidence and exposes uncertainty', () => {
  const p = calculateLabScoreV2(games(Array(10).fill(17)), {
    ...input,
    ...established,
    observations: [
      ...established.observations,
      evidence({ source: 'report', kind: 'report', status: 'QUESTIONABLE' }),
    ],
  });
  assert.equal(p.roleConfidence, 'LOW');
  assert.ok(p.reasons.some((r) => r.includes('conflict')));
});
test('no history produces no fabricated projection; zero recorded secondary workload is supported', () => {
  assert.equal(calculateLabScoreV2([], input).projection, null);
  assert.equal(calculateLabScoreV2([], input).score, 0);
  const history = games(Array(10).fill(17)).map((g) => ({ ...g, targets: 0, receivingYards: 0 }));
  assert.equal(
    calculateLabScoreV2(history, { ...input, statType: 'RUSHING_RECEIVING_YARDS' }).projection,
    68,
  );
});
test('projection does not depend on selected side or sportsbook line', () => {
  const history = games([15, 19, 17, 16, 20, 13]);
  const over = calculateLabScoreV2(history, { ...input, ...established });
  const under = calculateLabScoreV2(history, { ...input, ...established, side: 'UNDER', line: 90 });
  assert.equal(over.projection, under.projection);
  assert.equal(over.recommendation, 'OVER');
  assert.equal(under.recommendation, 'UNDER');
});
test('future games excluded and push outcomes separated from settled role-adjusted rate', () => {
  const history = games(Array(10).fill(10));
  const p = calculateLabScoreV2(
    [...history, { ...history[0]!, date: '2026-12-01', carries: 100, rushingYards: 900 }],
    { ...input, line: 40 },
  );
  assert.equal(p.projection, 40);
  assert.equal(p.rawL10.pushes, 10);
  assert.equal(p.roleAdjusted.hitRate, null);
  assert.equal(p.recommendation, null);
});
test('public scores default to the opportunity model while audits can compare legacy', () => {
  const history = games(Array(10).fill(17));
  const legacy = calculatePlayerPropTrend(history, {
    ...input,
    projectionContext: { asOf },
    scoreVersion: 'legacy',
  });
  const active = calculatePlayerPropTrend(history, {
    ...input,
    projectionContext: { asOf },
  });
  assert.equal(legacy.trendScore, legacy.researchScore.score);
  assert.equal(active.trendScore, active.projection.score);
  assert.equal(active.scoreVersion, 'v2');
});
test('feed parsers never assume absent players are healthy and reject invalid structured evidence', () => {
  assert.deepEqual(parseInjuryEvidence({ injuries: [] }, asOf).observations, []);
  assert.equal(
    parseDepthEvidence(
      [
        {
          pos_grp: 'Offense',
          pos_abb: 'QB',
          player_name: 'Unknown',
          team: 'KC',
          pos_rank: '1',
          dt: asOf,
        },
      ],
      asOf,
    ).unmapped,
    1,
  );
  assert.equal(
    roleObservationSchema.safeParse(evidence({ expected: { snapShare: 2 } })).success,
    false,
  );
});
test('audit excludes pushes from accuracy and reports both directions without balancing', () => {
  const projection = calculateLabScoreV2(games(Array(10).fill(17)), input);
  const report = summarizeScoreAudit([
    {
      eventId: 'e',
      playerId: 'p',
      statType: 'RUSHING_YARDS',
      position: 'RB',
      side: 'OVER',
      legacyScore: 80,
      projection,
      outcome: 'PUSH',
    },
  ]);
  assert.equal(report.v2.recommendations.accuracy, null);
  assert.equal(report.v2.recommendations.pushes, 1);
  assert.equal(report.v2.direction.OVER.percentage, 100);
});

test('vacated receiver targets can flow to tight ends while pass attempts remain with quarterbacks', () => {
  const history = [
    ...games(Array(10).fill(0)).map((g) => ({ ...g, position: 'TE', targets: 4 })),
    ...games(Array(10).fill(0), 'receiver').map((g) => ({ ...g, position: 'WR', targets: 10 })),
    ...games(Array(10).fill(0), 'qb').map((g) => ({
      ...g,
      position: 'QB',
      passingAttempts: 30,
      targets: 0,
    })),
  ];
  const role = expectedOpportunity(history, 'p', {
    asOf,
    teamId: 'KC',
    observations: [
      evidence({ playerId: 'receiver', position: 'WR', status: 'OUT' }),
      evidence({ playerId: 'qb', position: 'QB', status: 'OUT' }),
    ],
  });
  assert.ok(role.expected.targets! > 4);
  assert.equal(role.expected.passingAttempts, 0);
});

test('a depth change is detected without pretending it establishes an exact workload', () => {
  const history = games(Array(10).fill(17));
  const role = expectedOpportunity(history, 'p', {
    asOf,
    teamId: 'KC',
    ...established,
    observations: [
      ...established.observations,
      evidence({ kind: 'depth', depthRank: 3, sourceAt: '2026-09-30T12:00:00Z' }),
    ],
  });
  assert.equal(role.roleChange.severity, 'MODERATE');
  assert.equal(role.roleChange.direction, 'POSITIVE');
  assert.equal(role.roleConfidence, 'LOW');
  assert.equal(role.unquantifiedPromotion, true);
  assert.equal(role.expected.carries, 17);
});

test('fresh official unavailability outranks a conflicting secondary report', () => {
  const p = calculateLabScoreV2(games(Array(10).fill(17)), {
    ...input,
    ...established,
    observations: [
      evidence({ status: 'OUT' }),
      evidence({ kind: 'report', status: 'AVAILABLE', sourceAt: '2026-10-03T11:00:00Z' }),
    ],
  });
  assert.equal(p.recommendation, null);
  assert.equal(p.score, 0);
  assert.equal(p.roleConfidence, 'LOW');
});

test('new starter with only backup appearances has no invented under edge', () => {
  const context = {
    ...input,
    side: 'UNDER' as const,
    ...established,
    observations: [...established.observations, evidence({ kind: 'report', change: 'PROMOTED' })],
  };
  const history = games(Array(10).fill(2));
  const unknown = calculateLabScoreV2(history, context);
  assert.equal(unknown.rawL10.hits, 10);
  assert.equal(unknown.projection, null);
  assert.equal(unknown.recommendation, null);
  assert.equal(unknown.score, 0);
  const supported = calculateLabScoreV2(history, {
    ...context,
    side: 'OVER',
    observations: [
      ...context.observations,
      evidence({ kind: 'report', expected: { carries: 18 } }),
    ],
  });
  assert.equal(supported.recommendation, 'OVER');
  assert.ok(supported.projection! > input.line);
  assert.ok(supported.modelScore < 70); // A changed role still has sparse comparable evidence.
});

test('six requested weights, optional missing data reweighted and no tier ceilings', () => {
  assert.deepEqual(C.weights, {
    edge: 0.25,
    recent: 0.25,
    matchup: 0.2,
    opportunity: 0.15,
    history: 0.1,
    environment: 0.05,
  });
  const p = calculateLabScoreV2(games(Array(20).fill(20)), {
    ...input,
    ...established,
    line: 19.5,
  });
  assert.equal(p.components.matchup, null);
  assert.equal(p.components.environment, null);
  assert.equal(p.dataQuality.completeness, 75);
  assert.ok(p.score > 80, JSON.stringify(p));
  assert.deepEqual(p.caps, []);
});
test('exceptional fully evidenced opportunity can reach 95 without rank normalization', () => {
  const p = calculateLabScoreV2(games(Array(40).fill(20)), {
    ...input,
    ...established,
    line: 1.5,
    matchupSignal: 1,
    spread: -14,
    total: 58,
  });
  assert.ok(p.score >= 95, JSON.stringify(p));
});
test('extreme odds change betting value but never the confidence score', () => {
  const history = games(Array(20).fill(17));
  const a = calculateLabScoreV2(history, { ...input, ...established, line: 19.5, odds: -2400 });
  const b = calculateLabScoreV2(history, { ...input, ...established, line: 19.5, odds: -150 });
  assert.equal(a.score, b.score);
  assert.equal(a.estimatedProbability, b.estimatedProbability);
  assert.ok(a.bettingValue.expectedReturn! < b.bettingValue.expectedReturn!);
  assert.equal(a.bettingValue.extremePrice, true);
});
test('stale or very small samples never manufacture a probability', () => {
  assert.equal(calculateLabScoreV2(games([17, 18]), input).estimatedProbability, null);
  const old = games(Array(10).fill(17)).map((g) => ({ ...g, date: '2024-01-01' }));
  assert.equal(calculateLabScoreV2(old, input).estimatedProbability, null);
});
test('a larger credible projection edge improves score with comparable variance', () => {
  const history = games([17, 18, 16, 20, 15, 19, 16, 17, 16, 17]);
  const low = calculateLabScoreV2(history, { ...input, ...established, line: 65.5 });
  const high = calculateLabScoreV2(history, { ...input, ...established, line: 19.5 });
  assert.ok(high.score > low.score);
  assert.ok(high.estimatedProbability! > low.estimatedProbability!);
});

test('first observed starter depth does not turn backup production into an under recommendation', () => {
  const history = games(Array(10).fill(2)).map((g) => ({
    ...g,
    position: 'QB',
    passingAttempts: 2,
    passingYards: 12,
  }));
  const p = calculateLabScoreV2(history, {
    ...input,
    ...established,
    statType: 'PASSING_YARDS',
    line: 219.5,
    side: 'UNDER',
    observations: [evidence({ position: 'QB', kind: 'depth', depthRank: 1 })],
  });
  assert.equal(p.projection, null);
  assert.equal(p.estimatedProbability, null);
});
test('stale unrelated teammate reports do not lower an established player role confidence', () => {
  const p = calculateLabScoreV2(games(Array(10).fill(17)), {
    ...input,
    ...established,
    observations: [
      ...established.observations,
      evidence({ playerId: 'other', status: 'QUESTIONABLE', sourceAt: '2026-08-01' }),
    ],
  });
  assert.equal(p.roleConfidence, 'HIGH');
});
test('equal hit counts give more support to recent hits than old hits', () => {
  const rows = games(Array(10).fill(17));
  const recent = rows.map((g, i) => ({ ...g, rushingYards: i < 3 ? 80 : 30 }));
  const old = rows.map((g, i) => ({ ...g, rushingYards: i >= 7 ? 80 : 30 }));
  const a = calculateLabScoreV2(recent, { ...input, ...established });
  const b = calculateLabScoreV2(old, { ...input, ...established });
  assert.equal(a.rawL10.hits, b.rawL10.hits);
  assert.ok(a.components.recent! > b.components.recent!);
});

test('actual alternate thresholds improve Over and Under confidence monotonically without a bonus', () => {
  const history = games([19, 22, 18, 21, 20, 17, 23, 19, 21, 20]);
  for (const side of ['OVER', 'UNDER'] as const) {
    const thresholds = side === 'OVER' ? [79.5, 69.5, 49.5, 29.5] : [79.5, 89.5, 109.5, 139.5];
    const scores = thresholds.map((line) =>
      calculateLabScoreV2(history, { ...input, ...established, side, line }),
    );
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i].score >= scores[i - 1].score);
      assert.ok(scores[i].estimatedProbability! >= scores[i - 1].estimatedProbability!);
      assert.ok(scores[i].score <= 99);
    }
    assert.ok(scores.at(-1)!.score > scores[0].score);
  }
});

test('indexed player history and reused side trend preserve full-team scoring', async () => {
  const { evaluatePropSides } = await import('./prop-side-research-service');
  const own = games([12, 17, 15, 14, 20, 11, 9, 15, 14, 18]);
  const teamGames = [...own, ...games([10, 8, 11, 7], 'teammate')];
  const roleContext = { asOf, teamId: 'KC' };
  const context = {
    projectionContext: {
      ...roleContext,
      preparedOpportunity: expectedOpportunity(teamGames, 'p', roleContext),
    },
  };
  for (const side of ['OVER', 'UNDER'] as const) {
    const market = { playerId: 'p', marketType: 'RUSHING_YARDS', side, line: 35.5 };
    const input = {
      playerId: 'p',
      statType: 'RUSHING_YARDS' as const,
      side,
      line: 35.5,
      ...context,
    };
    const indexed = calculatePlayerPropTrend(own, input);
    assert.deepEqual(indexed, calculatePlayerPropTrend(teamGames, input));
    assert.deepEqual(
      evaluatePropSides(market, own, undefined, context, { side, trend: indexed }),
      evaluatePropSides(market, teamGames, undefined, context),
    );
  }
});
