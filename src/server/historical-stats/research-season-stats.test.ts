import assert from 'node:assert/strict';
import test from 'node:test';
import { researchSeasonStats } from './research-season-stats';
import type { HistoricalPlayerGame } from './types';
const game = (overrides: Partial<HistoricalPlayerGame>) =>
  ({ season: 2025, seasonType: 'REG', ...overrides }) as HistoricalPlayerGame;
test('uses the latest regular season and computes completion percentage from paired totals', () => {
  const result = researchSeasonStats(
    [
      game({ season: 2024, passingAttempts: 100, passingCompletions: 0 }),
      game({ passingAttempts: 10, passingCompletions: 9, passingYards: 100 }),
      game({ passingAttempts: 30, passingCompletions: 15, passingYards: 300 }),
      game({ season: 2026, seasonType: 'POST', passingAttempts: 100, passingCompletions: 0 }),
    ],
    'PASSING_YARDS',
  );
  assert.equal(result?.season, 2025);
  assert.equal(result?.items[0].value, '60.0%');
  assert.equal(result?.items[1].value, '200.0');
  assert.equal(result?.items[3].value, '—');
});
test('rushing and receiving props use relevant fields and preserve true zeroes', () => {
  const logs = [
    game({
      carries: 10,
      rushingYards: 50,
      rushingTds: 0,
      targets: 8,
      receptions: 6,
      receivingYards: 72,
      receivingTds: 1,
    }),
  ];
  assert.equal(researchSeasonStats(logs, 'RUSHING_YARDS')?.items[1].value, '5.0');
  assert.equal(researchSeasonStats(logs, 'RUSHING_YARDS')?.items[3].value, '0.0');
  assert.equal(researchSeasonStats(logs, 'RECEIVING_YARDS')?.items[0].value, '8.0');
  assert.equal(researchSeasonStats([], 'PASSING_YARDS'), null);
});
