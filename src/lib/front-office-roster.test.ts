import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignSimulationRoster,
  getActiveSimulationRoster,
  FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
} from './front-office-roster';
import type { PlayerRowDTO } from '@/types/player';
const pool = (count: number): PlayerRowDTO[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    firstName: 'Player',
    lastName: String(i),
    position: [
      'QB',
      'RB',
      'WR',
      'TE',
      'OT',
      'OG',
      'C',
      'EDGE',
      'DT',
      'LB',
      'CB',
      'S',
      'K',
      'P',
      'LS',
    ][i % 15],
    rating: 90 - i / 2,
    capHit: '$1M',
    contractYearsRemaining: 2,
    status: 'Active',
  }));
test('legacy 72-player seed becomes a balanced active lineup without deleting reserves', () => {
  const players = pool(72);
  const assigned = assignSimulationRoster(players);
  assert.equal(assigned.length, 72);
  assert.equal(getActiveSimulationRoster(assigned).length, FRONT_OFFICE_ACTIVE_ROSTER_LIMIT);
  assert.equal(assigned.filter((p) => p.rosterAssignment === 'reserve').length, 19);
  for (const pos of ['QB', 'K', 'P', 'LS'])
    assert(getActiveSimulationRoster(assigned).some((p) => p.position === pos));
  assert.deepEqual(players, pool(72));
  assert.deepEqual(assignSimulationRoster(assigned), assigned);
});
test('injured reserve, practice squad, cuts and other teams do not count as active', () => {
  const players = pool(8);
  players[0].status = 'Injured Reserve';
  players[1].status = 'Practice Squad';
  players[2].status = 'Cut';
  players[3].teamAbbr = 'KC';
  assert.equal(getActiveSimulationRoster(players, 'NYJ').length, 4);
});
test('explicit assignments remain authoritative, including a genuine over-limit roster', () => {
  const players = pool(54).map((p) => ({ ...p, rosterAssignment: 'active' as const }));
  assert.equal(getActiveSimulationRoster(players).length, 54);
  players[0].status = 'Cut';
  assert.equal(getActiveSimulationRoster(players).length, 53);
});
test('short and empty rosters are counted honestly rather than filled to 53', () => {
  assert.equal(getActiveSimulationRoster(pool(24)).length, 24);
  assert.equal(getActiveSimulationRoster([]).length, 0);
});
