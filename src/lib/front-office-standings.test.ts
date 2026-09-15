import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlayoffPicture, buildStandingsSnapshot } from './front-office-standings';
import type { FranchiseSimulationState } from '@/types/front-office';

const state = {
  seed: 'test',
  season: 2026,
  currentWeek: 2,
  phase: 'regular_season',
  teams: {
    KC: {
      abbr: 'KC',
      conference: 'AFC',
      division: 'West',
      overall: 88,
      record: { wins: 9, losses: 0, ties: 0 },
      pointsFor: 0,
      pointsAgainst: 0,
    },
    DEN: {
      abbr: 'DEN',
      conference: 'AFC',
      division: 'West',
      overall: 80,
      record: { wins: 0, losses: 9, ties: 0 },
      pointsFor: 0,
      pointsAgainst: 0,
    },
  },
  games: [
    {
      id: 'one',
      week: 1,
      seasonType: 'REG',
      homeTeam: 'KC',
      awayTeam: 'DEN',
      played: true,
      homeScore: 24,
      awayScore: 17,
      winner: 'KC',
    },
    {
      id: 'two',
      week: 2,
      seasonType: 'REG',
      homeTeam: 'DEN',
      awayTeam: 'KC',
      played: true,
      homeScore: 20,
      awayScore: 10,
      winner: 'DEN',
    },
  ],
  playoffs: null,
  draftOrder: [],
  transactions: [],
  completedAt: null,
} as FranchiseSimulationState;

test('builds historical standings only through the selected week', () => {
  const weekOne = buildStandingsSnapshot(state, 1);
  assert.deepEqual(weekOne.KC.record, { wins: 1, losses: 0, ties: 0 });
  assert.equal(weekOne.KC.pointDifferential, 7);
  const weekTwo = buildStandingsSnapshot(state, 2);
  assert.deepEqual(weekTwo.KC.record, { wins: 1, losses: 1, ties: 0 });
});

test('playoff picture seeds division winners before wild cards', () => {
  const snapshot = Object.values(buildStandingsSnapshot(state, 2));
  assert.equal(buildPlayoffPicture(snapshot, 'AFC')[0]?.abbr, 'DEN');
});
