import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePlayers, playerStatus } from './player-directory-data';
import type { HomeMarket } from './ParlayLabHome';
test('player aggregates exclude duplicates, alternate and opposite lines and compare separate windows', () => {
  const market = {
    id: 'm',
    playerId: 'p',
    playerName: 'Test Player',
    teamId: 'KC',
    available: true,
    side: 'OVER',
    lineType: 'main',
    marketType: 'PASSING_YARDS',
    period: 'game',
    trend: {
      trendScore: 90,
      gameLog: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-09-${20 - i}`,
        statValue: i < 8 ? 300 : 200,
        line: 249.5,
      })),
    },
  } as HomeMarket;
  const summary = summarizePlayers(
    [
      market,
      { ...market, id: 'book2' },
      { ...market, id: 'under', side: 'UNDER' },
      { ...market, id: 'alt', lineType: 'alternate', trend: { ...market.trend!, trendScore: 95 } },
      { ...market, id: 'unavailable', playerId: 'other', available: false },
    ],
    [],
  );
  assert.equal(summary.length, 1);
  assert.equal(summary[0].observations, 10);
  assert.equal(summary[0].hitRate, 80);
  assert.equal(summary[0].change, 40);
  assert.equal(summary[0].score, 95);
  assert.equal(playerStatus(summary[0])?.label, 'TRENDING UP');
});
test('missing history produces no rate, trend or featured claim', () => {
  const m = { playerId: 'p', playerName: 'Player', teamId: 'KC', available: true } as HomeMarket;
  const [p] = summarizePlayers([m], []);
  assert.equal(p.hitRate, null);
  assert.equal(p.change, null);
  assert.equal(playerStatus(p), null);
});
