import assert from 'node:assert/strict';
import test from 'node:test';

import { createFallbackRegularSeasonSchedule } from './calendar';

test('fallback calendar creates a complete 17-game schedule for all 32 teams', () => {
  const teams = Array.from({ length: 32 }, (_, index) => `T${String(index).padStart(2, '0')}`);
  const schedule = createFallbackRegularSeasonSchedule(teams, 2026);

  assert.equal(schedule.length, 272);
  for (const team of teams) {
    const games = schedule.filter((game) => game.homeTeam === team || game.awayTeam === team);
    assert.equal(games.length, 17);
    assert.equal(
      new Set(games.map((game) => [game.homeTeam, game.awayTeam].sort().join(':'))).size,
      17,
    );
  }
});
