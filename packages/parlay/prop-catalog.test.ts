import test from 'node:test';
import assert from 'node:assert/strict';
import { queryPropCatalog } from './prop-catalog';
import { formatProjection } from './projection-display';
import { isTrendingEligible } from './trending-selection';
import { addSlipLeg } from './slip';
import type { HomeMarket, OddsEvent } from './research';
const events = [
  { id: 'e', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-01-01', season: 2099 },
] as OddsEvent[];
const market = (id: string, extra: Partial<HomeMarket> = {}) =>
  ({
    id,
    eventId: 'e',
    playerId: id,
    playerName: id,
    teamId: 'KC',
    marketType: 'RECEPTIONS',
    period: 'game',
    line: 3.5,
    side: 'OVER',
    sportsbook: 'FANDUEL',
    odds: -110,
    available: true,
    lineType: 'main',
    ...extra,
  }) as HomeMarket;
const run = (rows: HomeMarket[], query = '') =>
  queryPropCatalog(rows, events, new URLSearchParams(query));
test('unrated and low scores remain in catalog; unavailable and locked events excluded', () => {
  const unrated = market('unrated');
  assert.equal(isTrendingEligible(unrated), false);
  assert.equal(
    run([unrated, market('suspended', { available: false }), market('expired', { eventId: 'old' })])
      .total,
    1,
  );
  assert.equal(
    queryPropCatalog([unrated], [{ ...events[0], marketsLocked: true }], new URLSearchParams())
      .total,
    0,
  );
});
test('Anytime TD retains identity with standard and alternate discovery and in slip', () => {
  const td = market('td', {
    marketType: 'TOUCHDOWNS',
    side: 'YES',
    line: null,
    lineType: 'unknown',
    odds: 145,
  });
  const alt = market('alt', { lineType: 'alternate', line: 1.5, odds: -300 });
  assert.equal(run([td, alt]).total, 1);
  const result = run([td, alt], 'altLines=true&maxOdds=-400');
  assert.equal(result.total, 2);
  const leg = addSlipLeg([], result.markets.find((m) => m.id === 'td')!)[0];
  assert.equal(leg.side, 'YES');
  assert.equal(leg.line, null);
  assert.equal(leg.marketType, 'TOUCHDOWNS');
  assert.equal(formatProjection(td), '—');
  assert.equal(
    formatProjection({
      ...td,
      trend: { projection: { projection: 1.2, estimatedProbability: 0.4 } } as HomeMarket['trend'],
    }),
    '40%',
  );
});
test('pagination, filters, best-book dedup and actual universe counts', () => {
  const rows = Array.from({ length: 30 }, (_, i) => market(`Player ${String(i).padStart(2, '0')}`));
  const result = run(
    [...rows, { ...rows[0], sportsbook: 'DRAFTKINGS', odds: 150 }],
    'page=2&sort=name',
  );
  assert.equal(result.stats.props, 30);
  assert.equal(result.markets.length, 12);
  assert.equal(result.total, 30);
  assert.equal(result.markets[0].playerName, 'Player 12');
  assert.equal(run(rows, 'search=player%200&category=RECEPTIONS').total, 12);
  assert.equal(run(rows, 'book=DRAFTKINGS').total, 0);
  assert.equal(run(rows, 'category=ANYTIME_TD').total, 0);
});
test('score sorts put unrated last in both directions and odds limits preserve positive odds', () => {
  const rated = (score: number) =>
    ({ trendScore: score, projection: { estimatedProbability: 0.5 } }) as HomeMarket['trend'];
  const rows = [
    market('none'),
    market('high', { trend: rated(80) }),
    market('low', { trend: rated(20) }),
  ];
  assert.deepEqual(
    run(rows, 'sort=score').markets.map((m) => m.id),
    ['high', 'low', 'none'],
  );
  assert.deepEqual(
    run(rows, 'sort=score-low').markets.map((m) => m.id),
    ['low', 'high', 'none'],
  );
  assert.equal(
    run(
      [
        market('expensive', { odds: -401 }),
        market('boundary', { odds: -400 }),
        market('plus', { odds: 150 }),
      ],
      'altLines=true&maxOdds=-400',
    ).total,
    2,
  );
});
