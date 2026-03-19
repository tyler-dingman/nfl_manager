import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import type { PlayerRowDTO } from '@/types/player';

const makePlayer = (
  id: string,
  position: string,
  rating: number,
  age: number,
): PlayerRowDTO => ({
  id,
  firstName: id,
  lastName: 'Player',
  position,
  rating,
  age,
  contractYearsRemaining: 2,
  capHit: '$5.0M',
  status: 'Active',
});

test('contender roster scores above rebuilding roster', () => {
  const contenderRoster = [
    makePlayer('qb', 'QB', 92, 27),
    makePlayer('wr1', 'WR', 89, 24),
    makePlayer('wr2', 'WR', 84, 23),
    makePlayer('lt', 'LT', 87, 25),
    makePlayer('edge1', 'EDGE', 88, 24),
    makePlayer('cb1', 'CB', 86, 26),
    makePlayer('s1', 'S', 82, 25),
  ];
  const rebuildingRoster = [
    makePlayer('qb', 'QB', 68, 31),
    makePlayer('wr1', 'WR', 69, 29),
    makePlayer('lt', 'LT', 66, 30),
    makePlayer('edge1', 'EDGE', 67, 29),
  ];

  const contender = computeFranchiseTrajectory({
    roster: contenderRoster,
    teamOverview: 88,
    capSpace: 18,
    capLimit: 255_000_000,
  });
  const rebuilding = computeFranchiseTrajectory({
    roster: rebuildingRoster,
    teamOverview: 69,
    capSpace: -8,
    capLimit: 255_000_000,
  });

  assert.ok(contender.score > rebuilding.score);
  assert.ok(['Contender', 'Rising'].includes(contender.state));
  assert.ok(['Declining', 'Rebuilding'].includes(rebuilding.state));
});
