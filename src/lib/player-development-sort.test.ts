import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDevelopmentPlayers, type DevelopmentSortColumn } from './player-development-sort';
const players = [
  {
    id: 'a',
    firstName: 'Zane',
    lastName: 'Smith',
    position: 'WR',
    age: 22,
    rating: 80,
    baselineRating: 83,
  },
  {
    id: 'b',
    firstName: 'Alex',
    lastName: 'Jones',
    position: 'QB',
    age: 31,
    rating: 90,
    baselineRating: 90,
  },
  {
    id: 'c',
    firstName: 'Ben',
    lastName: 'Hall',
    position: 'RB',
    age: 25,
    rating: 85,
    baselineRating: 81,
  },
];
const order = (column: DevelopmentSortColumn, direction: 'asc' | 'desc') =>
  [...players].sort((a, b) => compareDevelopmentPlayers(a, b, column, direction)).map((p) => p.id);
test('all six columns sort by their displayed values in both directions', () => {
  const ascending: Record<DevelopmentSortColumn, string[]> = {
    Player: ['b', 'c', 'a'],
    Position: ['b', 'c', 'a'],
    Age: ['a', 'c', 'b'],
    OVR: ['a', 'c', 'b'],
    Baseline: ['c', 'a', 'b'],
    Change: ['a', 'b', 'c'],
  };
  for (const column of Object.keys(ascending) as DevelopmentSortColumn[]) {
    assert.deepEqual(order(column, 'asc'), ascending[column]);
    assert.deepEqual(order(column, 'desc'), [...ascending[column]].reverse());
  }
});
test('missing baselines stay last while zero and negative changes sort numerically', () => {
  const unknown = { ...players[0], id: 'unknown', baselineRating: undefined };
  for (const direction of ['asc', 'desc'] as const) {
    const sorted = [unknown, ...players].sort((a, b) =>
      compareDevelopmentPlayers(a, b, 'Change', direction),
    );
    assert.equal(sorted.at(-1)?.id, 'unknown');
  }
});
test('default change order breaks ties by current OVR without mutating the roster', () => {
  const tied = players.map((p) => ({ ...p, baselineRating: p.rating - 2 }));
  assert.deepEqual(
    [...tied].sort((a, b) => compareDevelopmentPlayers(a, b, 'Change', 'desc')).map((p) => p.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    tied.map((p) => p.id),
    ['a', 'b', 'c'],
  );
});
