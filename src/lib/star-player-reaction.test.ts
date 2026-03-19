import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStarReactionToastPayload,
  getPlayerSide,
  getTopRatedRosterPlayerBySide,
} from '@/lib/star-player-reaction';
import type { PlayerRowDTO } from '@/types/player';

const makePlayer = (overrides: Partial<PlayerRowDTO>): PlayerRowDTO => ({
  id: overrides.id ?? 'p1',
  firstName: overrides.firstName ?? 'Player',
  lastName: overrides.lastName ?? 'One',
  position: overrides.position ?? 'WR',
  rating: overrides.rating,
  maddenRating: overrides.maddenRating,
  baselineRating: overrides.baselineRating,
  headshotUrl: overrides.headshotUrl ?? null,
  contractYearsRemaining: overrides.contractYearsRemaining ?? 1,
  capHit: overrides.capHit ?? '$1.0M',
  status: overrides.status ?? 'Active',
  ...overrides,
});

test('classifies offense and defense positions', () => {
  assert.equal(getPlayerSide('WR'), 'offense');
  assert.equal(getPlayerSide('LT'), 'offense');
  assert.equal(getPlayerSide('EDGE'), 'defense');
  assert.equal(getPlayerSide('FS'), 'defense');
  assert.equal(getPlayerSide('K'), null);
});

test('selects top-rated same-side roster player excluding the incoming player', () => {
  const roster = [
    makePlayer({ id: 'qb1', firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', rating: 95 }),
    makePlayer({ id: 'wr1', firstName: 'Tyreek', lastName: 'Hill', position: 'WR', rating: 91 }),
    makePlayer({ id: 'cb1', firstName: 'Trent', lastName: 'McDuffie', position: 'CB', rating: 88 }),
  ];

  const reactingPlayer = getTopRatedRosterPlayerBySide(roster, 'offense', 'wr1');
  assert.equal(reactingPlayer?.id, 'qb1');
});

test('builds a deterministic toast payload for a valid move', () => {
  const roster = [
    makePlayer({ id: 'qb1', firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', rating: 95 }),
    makePlayer({ id: 'wr1', firstName: 'Tee', lastName: 'Higgins', position: 'WR', rating: 89 }),
  ];

  const payload = buildStarReactionToastPayload({
    incomingPlayer: makePlayer({ id: 'wr1', firstName: 'Tee', lastName: 'Higgins', position: 'WR' }),
    roster,
    actionType: 'freeAgency',
    teamAbbr: 'KC',
    teamName: 'Kansas City Chiefs',
  });

  assert.ok(payload);
  assert.equal(payload?.displayName, 'Patrick Mahomes');
  assert.equal(payload?.subtitle, 'Chiefs Locker Room');
  assert.ok(payload?.message.length);
});

test('returns null when the incoming player position is not offense or defense', () => {
  const roster = [makePlayer({ id: 'qb1', firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', rating: 95 })];

  const payload = buildStarReactionToastPayload({
    incomingPlayer: makePlayer({ id: 'k1', firstName: 'Harrison', lastName: 'Butker', position: 'K' }),
    roster,
    actionType: 'trade',
    teamAbbr: 'KC',
    teamName: 'Kansas City Chiefs',
  });

  assert.equal(payload, null);
});
