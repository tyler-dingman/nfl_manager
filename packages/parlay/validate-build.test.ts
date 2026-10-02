import assert from 'node:assert/strict';
import test from 'node:test';
import { validateParlayBuild } from './validate-build';
const leg = {
  id: 'one',
  sportsbook: 'DRAFTKINGS' as const,
  eventId: 'game',
  available: true,
  line: 20.5,
  odds: -110,
  side: 'OVER',
  trend: { trendScore: 90 },
};
const games = [{ id: 'game', kickoffAt: '2030-01-01T00:00:00Z' }];
test('refresh rejects changed prices, lines, lower research scores, and locked games', () => {
  for (const patch of [
    { odds: -120 },
    { line: 21.5 },
    { available: false },
    { trend: { trendScore: 50 } },
  ])
    assert.equal(
      validateParlayBuild([leg], [{ ...leg, ...patch }], games, 80, 0)[0],
      undefined,
    );
  assert.equal(
    validateParlayBuild([leg], [leg], [{ ...games[0], marketsLocked: true }], 80, 0)[0],
    undefined,
  );
});
test('refresh returns the fresh market only while its game is upcoming', () => {
  const fresh = { ...leg, playerName: 'Updated player' };
  assert.equal(validateParlayBuild([leg], [fresh], games, 80, 0)[0], fresh);
  assert.equal(
    validateParlayBuild([leg], [fresh], games, 80, Date.parse('2031-01-01'))[0],
    undefined,
  );
});
