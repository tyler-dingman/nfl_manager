import assert from 'node:assert/strict';
import test from 'node:test';
import { rankTrendingProps, representativeTrends } from './trending-selection';
const offer = (id: string, side: string, score = 75) => ({
  id,
  odds: -110,
  playerId: id,
  eventId: 'game',
  marketType: 'PASSING_YARDS',
  period: 'game',
  side,
  trend: {
    trendScore: score,
    projection: {
      projection: 200,
      recommendation: side,
      estimatedProbability: 0.7,
      pushProbability: 0,
      dataQuality: { reliability: 0.8, freshness: 1, currentRoleKnown: true },
    },
  },
});
test('mixed feed targets 7 overs and 3 unders without altering scores or input order', () => {
  const rows = Array.from({ length: 20 }, (_, i) => offer(`u${i}`, 'UNDER', 90 - i)).concat(
    Array.from({ length: 20 }, (_, i) => offer(`o${i}`, 'OVER', 80 - i)),
  );
  const before = structuredClone(rows);
  const ranked = rankTrendingProps(rows);
  assert.equal(ranked.slice(0, 10).filter((r) => r.side === 'OVER').length, 7);
  assert.equal(ranked.slice(10, 20).filter((r) => r.side === 'OVER').length, 7);
  assert.deepEqual(rows, before);
  assert.equal(new Set(ranked).size, rows.length);
  assert.deepEqual(
    ranked.filter((r) => r.side === 'OVER').map((r) => r.id),
    rows.filter((r) => r.side === 'OVER').map((r) => r.id),
  );
});
test('single-sided and sparse pools fill naturally without inventing qualifying props', () => {
  const rows = [
    offer('o', 'OVER'),
    ...Array.from({ length: 10 }, (_, i) => offer(`u${i}`, 'UNDER', 70 - i)),
  ];
  assert.equal(rankTrendingProps(rows).length, 11);
  assert.equal(rankTrendingProps(rows).filter((r) => r.side === 'OVER').length, 1);
  assert.deepEqual(rankTrendingProps(rows.slice(1)), rows.slice(1));
  assert.deepEqual(rankTrendingProps([]), []);
});
test('unsupported, unavailable, and zero-score projections cannot displace supported picks', () => {
  const unsupported = offer('bad', 'OVER', 99);
  unsupported.trend.projection.recommendation = 'UNDER';
  const zero = offer('zero', 'OVER', 0);
  const good = offer('good', 'UNDER', 70);
  const missing = { ...offer('missing', 'OVER', 100), trend: null };
  assert.equal(rankTrendingProps([unsupported, zero, good, missing])[0], good);
});
test('representative selection collapses books and alternate lines before balancing', () => {
  const main = { ...offer('p', 'OVER', 60), lineType: 'main' };
  const alt = {
    ...main,
    id: 'alt',
    lineType: 'alternate',
    trend: { ...main.trend, trendScore: 62 },
  };
  assert.deepEqual(representativeTrends([alt, main]), [main]);
});

test('weak and extreme-priced props are excluded even when the feed cannot reach 70/30', () => {
  const strong = offer('strong', 'UNDER', 85);
  const poor = offer('weak', 'OVER', 49);
  const expensive = { ...offer('price', 'OVER', 99), odds: -2400 };
  assert.deepEqual(rankTrendingProps([poor, expensive, strong]), [strong]);
});
test('better value outranks a higher hit probability in the same direction', () => {
  const expensive = { ...offer('expensive', 'OVER', 90), odds: -600 };
  expensive.trend.projection.estimatedProbability = 0.86;
  const value = { ...offer('value', 'OVER', 83), odds: -150 };
  value.trend.projection.estimatedProbability = 0.78;
  assert.equal(rankTrendingProps([expensive, value])[0], value);
});

test('unconfirmed current roles remain research-only even with high scores and attractive odds', () => {
  const row = offer('uncertain', 'OVER', 95);
  row.trend.projection.dataQuality.currentRoleKnown = false;
  assert.deepEqual(rankTrendingProps([row]), []);
});
