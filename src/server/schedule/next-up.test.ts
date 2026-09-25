import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNextUp } from './next-up';
import { scheduleFailure } from './diagnostics';
import type { CanonicalGame } from '@/lib/canonical-game';

const game: CanonicalGame = {
  id: 'canonical-game',
  season: 2026,
  seasonType: 'REG',
  week: 3,
  homeTeam: 'MIA',
  awayTeam: 'KC',
  kickoffAt: '2026-09-27T17:00:00.000Z',
  kickoffConfirmed: true,
  status: 'SCHEDULED',
  homeScore: null,
  awayScore: null,
  overtime: false,
  venue: null,
  broadcastNetwork: null,
};

test('a missing venue or unavailable odds does not hide the next game', async () => {
  for (const nextGameMarkets of [
    async () => null,
    async () => {
      throw new Error('Optional odds unavailable');
    },
  ]) {
    const result = await loadNextUp('KC', {
      nextCanonicalGame: async () => game,
      nextGameMarkets,
    });
    assert.deepEqual(result, { game, betting: null });
  }
});

test('saved odds retain their existing Parlay Lab game ID', async () => {
  const betting = {
    eventId: 'saved-event-id',
    spread: 'KC -3.5',
    total: 'O/U 44.5',
    moneyline: 'KC -170',
  };
  const result = await loadNextUp('KC', {
    nextCanonicalGame: async () => game,
    nextGameMarkets: async (received) => {
      assert.equal(received, game);
      return betting;
    },
  });
  assert.deepEqual(result, { game, betting });
});

test('only actual schedule failures propagate, and no-game results skip odds', async () => {
  const nextGameMarkets = async () => {
    assert.fail('Should not query odds without a game');
  };
  assert.deepEqual(
    await loadNextUp('KC', { nextCanonicalGame: async () => null, nextGameMarkets }),
    { game: null, betting: null },
  );
  await assert.rejects(
    loadNextUp('KC', {
      nextCanonicalGame: async () => {
        throw new Error('Schedule failed');
      },
      nextGameMarkets,
    }),
    /Schedule failed/,
  );
  const diagnostic = scheduleFailure({
    code: '42703',
    message: 'secret connection string',
    query: 'private SQL',
  });
  assert.equal(diagnostic.databaseCode, '42703');
  assert.equal(diagnostic.migration, 'db/migrations/042_canonical_schedule.sql');
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret connection|private SQL/);
});
