import test from 'node:test';
import assert from 'node:assert/strict';
import { queryPropCatalog } from './prop-catalog';
import { primaryMarketOptions, secondaryMarketOptions } from './market-navigation';
import type { HomeMarket, OddsEvent } from './research';
const events = [
  { id: 'game', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-10-01' },
] as OddsEvent[];
const market = (
  id: string,
  playerId: string,
  score: number,
  lineType = 'main',
  extra: Partial<HomeMarket> = {},
) =>
  ({
    id,
    eventId: 'game',
    playerId,
    playerName: playerId,
    teamId: 'KC',
    period: 'game',
    marketType: 'RECEIVING_YARDS',
    side: 'OVER',
    line: lineType === 'main' ? 74.5 : 54.5,
    lineType,
    available: true,
    odds: -110,
    sportsbook: 'FANDUEL',
    trend: {
      trendScore: score,
      projection: {
        modelScore: score,
        projection: 90,
        estimatedProbability: 0.8,
        recommendation: 'OVER',
        dataQuality: { reliability: 0.9, freshness: 1, currentRoleKnown: true },
      },
      last10: { games: 10, hits: 8, hitRate: 80 },
    },
    ...extra,
  }) as HomeMarket;
const query = (rows: HomeMarket[], q = '') =>
  queryPropCatalog(rows, events, new URLSearchParams('grouped=true&altLines=true&' + q));
test('group ranking follows highest eligible score but standard remains primary', () => {
  const rows = [
    market('a-main', 'A', 75),
    market('a-alt', 'A', 95, 'alternate'),
    market('b-main', 'B', 90),
  ];
  const result = query(rows);
  assert.deepEqual(
    result.groups.map((g) => g.primary.id),
    ['a-main', 'b-main'],
  );
  assert.equal(result.groups[0].bestScore, 95);
  assert.deepEqual(
    result.groups[0].selections.map((m) => m.id),
    ['a-main', 'a-alt'],
  );
  assert.equal(result.total, 3);
  assert.equal(result.totalGroups, 2);
});
test('ineligible alternate is absent and cannot rank a trending group', () => {
  const bad = market('bad', 'A', 99, 'alternate', { trend: null });
  const rows = [
    market('a-main', 'A', 75),
    bad,
    market('b-main', 'B', 90),
    market('unrated', 'C', 0, 'main', { trend: null }),
  ];
  const result = query(rows, 'view=trends');
  assert.deepEqual(
    result.groups.map((g) => g.primary.id),
    ['b-main', 'a-main'],
  );
  assert.equal(result.total, 2);
  assert.equal(query(rows).total, 4);
});
test('alternate-only group leads with best eligible selection and keeps exact identity', () => {
  const rows = [
    market('low', 'A', 70, 'alternate', { line: 34.5 }),
    market('high', 'A', 90, 'alternate', { line: 54.5, sportsbook: 'DRAFTKINGS' }),
  ];
  const result = query(rows);
  assert.equal(result.groups[0].primary, rows[1]);
  assert.equal(result.groups[0].primary.sportsbook, 'DRAFTKINGS');
  assert.equal(result.groups[0].primary.line, 54.5);
});
test('group pagination never splits player markets and respects side/book filters', () => {
  const rows = Array.from({ length: 14 }, (_, i) => [
    market(`main${i}`, `Player ${i}`, 80),
    market(`alt${i}`, `Player ${i}`, 85, 'alternate'),
  ]).flat();
  const a = query(rows),
    b = query(rows, 'page=2');
  assert.equal(a.groups.length, 12);
  assert.equal(a.markets.length, 24);
  assert.equal(b.groups.length, 2);
  assert.equal(b.markets.length, 4);
  assert.equal(a.total, 28);
  assert.equal(a.totalGroups, 14);
  assert.ok(a.groups.every((g) => !b.groups.some((h) => h.key === g.key)));
  assert.equal(query(rows, 'book=DRAFTKINGS').totalGroups, 0);
  assert.equal(query(rows, 'side=UNDER').totalGroups, 0);
});
test('facets contain only offered markets, matching navigation on both views', () => {
  const rows = [
    market('yards', 'A', 80),
    market('receptions', 'A', 80, 'main', { marketType: 'RECEPTIONS' }),
    market('td', 'A', 80, 'main', { marketType: 'TOUCHDOWNS', side: 'YES', line: null }),
  ];
  const all = query(rows),
    trends = query(rows, 'view=trends');
  assert.deepEqual(all.facets, trends.facets);
  assert.deepEqual(
    primaryMarketOptions(all.facets).map(([id]) => id),
    ['ALL', 'RECEIVING', 'TOUCHDOWN'],
  );
  assert.deepEqual(
    secondaryMarketOptions(all.facets, 'RECEIVING').map((m) => m.id),
    ['ALL', 'RECEIVING_YARDS', 'RECEPTIONS'],
  );
  assert.equal(query(rows, 'category=RECEIVING&market=RECEPTIONS').total, 1);
  assert.equal(query(rows, 'category=TOUCHDOWN&market=ANYTIME_TD').markets[0].side, 'YES');
});
