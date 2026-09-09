import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeFranchiseSimulation } from './repository';

const simulation = {
  seed: 'save:2026',
  season: 2026,
  currentWeek: 0,
  phase: 'preseason',
  teams: {},
  games: [],
  playoffs: null,
  draftOrder: [],
  transactions: [],
  completedAt: null,
};

test('normalizes proper JSONB objects and legacy JSON-string simulation rows', () => {
  assert.deepEqual(normalizeFranchiseSimulation(simulation), simulation);
  assert.deepEqual(normalizeFranchiseSimulation(JSON.stringify(simulation)), simulation);
});

test('treats malformed legacy simulation state as uninitialized', () => {
  assert.equal(normalizeFranchiseSimulation('{broken'), null);
  assert.equal(normalizeFranchiseSimulation(null), null);
});
