import assert from 'node:assert/strict';
import test from 'node:test';
import type { FranchiseGameState, SimulatedPlayerStat } from '@/types/front-office';
import { summarizeSimulatedPlayerStats } from './simulated-player-stats';
const game = (id: string, stats: Partial<SimulatedPlayerStat>, played = true) =>
  ({ id, played, result: { playerStats: [{ playerId: 'rb', ...stats }] } }) as FranchiseGameState;

test('sums recorded stats by player ID across trades, preserves zeros, and skips duplicates/unplayed games', () => {
  const first = game('1', { teamAbbr: 'SEA', rushingYards: 91, rushingTD: 0, receptions: 2 });
  const result = summarizeSimulatedPlayerStats(
    [
      first,
      first,
      game('2', { teamAbbr: 'KC', rushingYards: 106, rushingTD: 0, receptions: 3 }),
      game('3', { rushingYards: 999 }, false),
      game('4', { playerId: 'other', rushingYards: 800 }),
    ],
    'rb',
  );
  assert.equal(result.recordedGames, 2);
  assert.deepEqual(result.stats, [
    { label: 'Rushing yards', value: '197' },
    { label: 'Rushing TDs', value: '0' },
    { label: 'Receptions', value: '5' },
  ]);
});
test('missing historic box scores do not fabricate stats or games played', () => {
  assert.deepEqual(
    summarizeSimulatedPlayerStats([{ id: 'old', played: true } as FranchiseGameState], 'rb'),
    { recordedGames: 0, stats: [] },
  );
});
test('keeps fractional sacks and passing and defensive interceptions distinct', () => {
  const result = summarizeSimulatedPlayerStats(
    [
      game('1', { sacks: 0.5, interceptions: 1, defensiveInterceptions: 2 }),
      game('2', { sacks: 1 }),
    ],
    'rb',
  );
  assert.deepEqual(result.stats, [
    { label: 'Interceptions thrown', value: '1' },
    { label: 'Sacks', value: '1.5' },
    { label: 'Defensive interceptions', value: '2' },
  ]);
});
