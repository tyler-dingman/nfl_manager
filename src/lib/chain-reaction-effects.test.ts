import test from 'node:test';
import assert from 'node:assert/strict';

import { generateChainReactionEffects } from '@/lib/chain-reaction-effects';
import type { PlayerRowDTO } from '@/types/player';

const makePlayer = (id: string, position: string, rating: number): PlayerRowDTO => ({
  id,
  firstName: id,
  lastName: 'Player',
  position,
  rating,
  age: 26,
  contractYearsRemaining: 2,
  capHit: '$5.0M',
  status: 'Active',
});

test('signing into a weak room creates upgraded room feedback', () => {
  const beforeRoster = [
    makePlayer('wr1', 'WR', 73),
    makePlayer('wr2', 'WR', 71),
    makePlayer('qb', 'QB', 86),
  ];
  const afterRoster = [...beforeRoster, makePlayer('wr3', 'WR', 87)];

  const result = generateChainReactionEffects({
    beforeRoster,
    afterRoster,
    beforeCapSpace: 22,
    afterCapSpace: 15,
    moveType: 'freeAgency',
    player: { position: 'WR' },
  });

  assert.ok(result);
  assert.ok(result.effects.some((effect) => effect.message.includes('room upgraded')));
});
