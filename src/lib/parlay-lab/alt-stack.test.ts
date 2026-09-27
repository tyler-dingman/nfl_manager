import assert from 'node:assert/strict';
import test from 'node:test';
import type { HomeMarket } from '@/components/parlay-lab/ParlayLabHome';
import {
  DEFAULT_ALT_STACK,
  rankAltStackCandidates,
  selectAltStack,
  swapAltStackLeg,
} from './alt-stack';
const games = [
  { id: 'game', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-01-01T00:00:00Z' },
];
function market(id: string, line = 49.5, hits = 9, odds = -325): HomeMarket {
  return {
    id,
    playerId: id,
    eventId: 'game',
    playerName: id,
    marketType: 'RECEIVING_YARDS',
    statId: 'receiving_yards',
    side: 'OVER',
    line,
    mainLine: 67.5,
    lineType: 'alternate',
    period: 'game',
    available: true,
    odds,
    sportsbook: 'FANDUEL',
    trend: {
      last5: { hits: 5, games: 5 },
      last10: { hits, games: 10 },
      season: { hits: 9, games: 10 },
      last2Years: { hits: 17, games: 20 },
    },
  } as HomeMarket;
}
test('target price balances consistency rather than picking the most expensive line', () => {
  const pool = rankAltStackCandidates(
    [market('low', 39.5, 10, -900), market('mid'), market('high', 59.5, 7, -175)],
    games,
    DEFAULT_ALT_STACK,
  );
  assert.equal(pool[0].id, 'mid');
  assert.equal(pool.length, 2);
});
test('rejects main/unknown lines, unavailable prices, small samples and started games', () => {
  const good = market('good');
  const pool = rankAltStackCandidates(
    [
      good,
      { ...good, id: 'main', lineType: 'main' },
      { ...good, id: 'no-main', mainLine: null },
      { ...good, id: 'closed', available: false },
      { ...good, id: 'null', odds: null },
      { ...good, id: 'higher', line: 70 },
      { ...good, id: 'under', side: 'UNDER' },
      {
        ...good,
        id: 'short',
        trend: { ...good.trend!, last10: { hits: 5, games: 5, hitRate: 100 } },
      },
    ],
    games,
    DEFAULT_ALT_STACK,
  );
  assert.deepEqual(
    pool.map((m) => m.id),
    ['good'],
  );
  assert.equal(
    rankAltStackCandidates([good], [{ ...games[0], kickoffAt: '2000-01-01' }], DEFAULT_ALT_STACK)
      .length,
    0,
  );
});
test('selects requested sizes at one book, without duplicate players or partial fills', () => {
  const rows = Array.from({ length: 12 }, (_, i) => market(String(i)));
  const pool = rankAltStackCandidates(
    [...rows, ...rows.map((m) => ({ ...m, sportsbook: 'DRAFTKINGS' as const }))],
    games,
    DEFAULT_ALT_STACK,
  );
  for (const count of [4, 6, 8, 10]) {
    const { legs } = selectAltStack(pool, count);
    assert.equal(legs.length, count);
    assert.equal(new Set(legs.map((m) => m.playerId)).size, count);
    assert.equal(new Set(legs.map((m) => m.sportsbook)).size, 1);
  }
  assert.equal(selectAltStack(pool.slice(0, 2), 8).legs.length, 0);
});
test('swap replaces only a single leg with an unused player at the same book', () => {
  const pool = rankAltStackCandidates(
    Array.from({ length: 6 }, (_, i) => market(String(i))),
    games,
    DEFAULT_ALT_STACK,
  );
  const legs = selectAltStack(pool, 4).legs;
  const copy = JSON.stringify(legs);
  const replacement = swapAltStackLeg(pool, legs, 1);
  assert.ok(replacement);
  assert.ok(!legs.some((m) => m.playerId === replacement.playerId));
  assert.equal(JSON.stringify(legs), copy);
  assert.equal(swapAltStackLeg(legs, legs, 1), null);
});
test('respects game and prop filters and requires the configured historical hits', () => {
  assert.equal(
    rankAltStackCandidates([market('a')], games, { ...DEFAULT_ALT_STACK, games: ['other'] }).length,
    0,
  );
  assert.equal(
    rankAltStackCandidates([market('a')], games, { ...DEFAULT_ALT_STACK, markets: ['RECEPTIONS'] })
      .length,
    0,
  );
  assert.equal(
    rankAltStackCandidates([market('a')], games, { ...DEFAULT_ALT_STACK, minHits: 10 }).length,
    0,
  );
});
