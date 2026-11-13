import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRelativePropScores, relativePropScores, relativePickKey } from './relative-score';
import { isTrendingEligible } from './trending-selection';
import { queryPropCatalog } from './prop-catalog';
import type { HomeMarket, OddsEvent } from './research';
const market = (i: number) =>
  ({
    id: `m${i}`,
    eventId: 'g',
    playerId: `p${i}`,
    playerName: `P${i}`,
    teamId: 'KC',
    period: 'game',
    marketType: 'RECEPTIONS',
    line: 2.5,
    side: 'OVER',
    lineType: 'main',
    available: true,
    odds: -110,
    sportsbook: 'FANDUEL',
    trend: {
      trendScore: 99 - i,
      projection: {
        modelScore: 99 - i,
        score: 99 - i,
        projection: 4,
        estimatedProbability: 0.7,
        pushProbability: 0,
        recommendation: 'OVER',
        dataQuality: { reliability: 0.8, freshness: 1, currentRoleKnown: true },
      },
    },
  }) as HomeMarket;

test('top decile occupies 90–97, remainder 1–89, without changing probabilities or eligibility', () => {
  const rows = Array.from({ length: 100 }, (_, i) => market(i));
  // Give the last pick a supported positive model score too.
  rows[99].trend!.projection!.modelScore = 0.1;
  const before = structuredClone(rows),
    result = applyRelativePropScores(rows);
  assert.equal(result.scoreScale.population, 100);
  const values = result.markets.map((m) => m.trend!.trendScore);
  assert.equal(values.filter((n) => n >= 90).length, 10);
  assert.equal(values[0], 97);
  assert.equal(values[9], 90);
  assert.equal(values[10], 89);
  assert.equal(values[99], 1);
  assert.ok(values.slice(1).every((n, i) => n <= values[i]));
  for (let i = 0; i < rows.length; i++) {
    assert.equal(
      result.markets[i].trend!.projection!.estimatedProbability,
      rows[i].trend!.projection!.estimatedProbability,
    );
    assert.equal(
      result.markets[i].trend!.projection!.modelScore,
      rows[i].trend!.projection!.modelScore,
    );
    assert.equal(isTrendingEligible(result.markets[i]), isTrendingEligible(rows[i]));
  }
  assert.deepEqual(rows, before);
});
test('duplicates across books do not inflate the cohort; filters never rebase scores', () => {
  const rows = Array.from({ length: 20 }, (_, i) => market(i));
  const duplicate = { ...rows[0], sportsbook: 'DRAFTKINGS' as const };
  const a = relativePropScores(rows),
    b = relativePropScores([...rows, duplicate]);
  assert.deepEqual(a.scores, b.scores);
  const scaled = applyRelativePropScores([...rows, duplicate]);
  assert.equal(scaled.markets[0].trend!.trendScore, scaled.markets.at(-1)!.trend!.trendScore);
  const events = [
    { id: 'g', kickoffAt: '2099-01-01', homeTeamId: 'KC', awayTeamId: 'SEA' },
  ] as OddsEvent[];
  const filtered = queryPropCatalog(scaled.markets, events, new URLSearchParams('book=DRAFTKINGS'));
  assert.equal(filtered.markets[0].trend!.trendScore, 97);
});
test('stable identity breaks tied evidence ranks independently of input order', () => {
  const rows = Array.from({ length: 20 }, (_, i) => market(i));
  for (const m of rows) m.trend!.projection!.modelScore = 60;
  assert.deepEqual(relativePropScores(rows).scores, relativePropScores([...rows].reverse()).scores);
  assert.equal([...relativePropScores(rows).scores.values()].filter((n) => n >= 90).length, 2);
});
test('missing/unsupported/zero evidence is never promoted into the top decile', () => {
  const missing = { ...market(1), trend: null };
  const unavailable = { ...market(2), available: false };
  const unsupported = market(3);
  unsupported.trend!.projection!.estimatedProbability = null;
  const zero = market(4);
  zero.trend!.projection!.modelScore = 0;
  const rows = [market(0), missing, unavailable, unsupported, zero];
  const r = relativePropScores(rows);
  assert.equal(r.population, 1);
  assert.equal(r.scores.get(relativePickKey(rows[0])), 97);
  assert.equal(applyRelativePropScores([]).scoreScale.population, 0);
  assert.equal(applyRelativePropScores([missing]).markets[0].trend, null);
});

test('a pick has one score across books even when one price exceeds the alternate cap', () => {
  const rows = Array.from({ length: 20 }, (_, i) => market(i));
  const good = { ...market(0), lineType: 'alternate' as const, odds: -200 };
  const expensive = { ...good, sportsbook: 'DRAFTKINGS' as const, odds: -2000 };
  const result = applyRelativePropScores([...rows, good, expensive]);
  assert.equal(result.markets.at(-1)!.trend!.trendScore, result.markets.at(-2)!.trend!.trendScore);
});
