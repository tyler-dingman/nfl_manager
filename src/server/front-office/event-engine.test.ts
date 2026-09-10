import assert from 'node:assert/strict';
import test from 'node:test';
import { createFranchiseSimulation, advanceSimulation } from '@/lib/franchise-simulation';
import { generateFrontOfficeEvents } from './event-engine';

const teams = [
  { abbr: 'CHI', conference: 'NFC', division: 'North', overall: 80 },
  { abbr: 'GB', conference: 'NFC', division: 'North', overall: 80 },
];

test('front office event engine creates stable, state-backed events', () => {
  const initial = createFranchiseSimulation({
    seed: 'test',
    season: 2026,
    teams,
    games: [{ id: 'g1', week: 1, homeTeam: 'CHI', awayTeam: 'GB' }],
  });
  const advanced = advanceSimulation(initial, 'week-1');
  const first = generateFrontOfficeEvents({
    saveId: 'save',
    teamAbbr: 'CHI',
    previous: initial,
    current: advanced,
  });
  const second = generateFrontOfficeEvents({
    saveId: 'save',
    teamAbbr: 'CHI',
    previous: initial,
    current: advanced,
  });
  assert.deepEqual(first, second);
  assert.equal(
    first.some((event) => event.dedupeKey.startsWith('game:')),
    false,
  );
});

test('front office event engine caps generated events per simulated week', () => {
  const initial = createFranchiseSimulation({
    seed: 'bulk',
    season: 2026,
    teams,
    games: [{ id: 'g1', week: 1, homeTeam: 'CHI', awayTeam: 'GB' }],
  });
  const advanced = advanceSimulation(initial, 'week-1');
  const events = generateFrontOfficeEvents({
    saveId: 'save',
    teamAbbr: 'CHI',
    previous: initial,
    current: advanced,
  });
  assert.ok(events.length <= 3);
});

test('weekly progression persists re-sign readiness on the referenced player', () => {
  const initial = createFranchiseSimulation({
    seed: 'ready-event',
    season: 2026,
    teams,
    games: [],
  });
  const advanced = advanceSimulation(initial, 'week-18');
  const events = generateFrontOfficeEvents({
    saveId: 'save',
    teamAbbr: 'CHI',
    previous: initial,
    current: advanced,
    reSignCandidates: [
      {
        playerId: 'player-1',
        contractId: 'CHI:player-1:2026',
        name: 'Priority Player',
        position: 'QB',
        rating: 91,
        age: 27,
        contractValue: 40_000_000,
        headshotUrl: null,
        priorityScore: 250,
      },
    ],
  });
  const ready = events.find((event) => event.type === 're_sign_ready');
  assert.equal(ready?.playerId, 'player-1');
  assert.equal(advanced.contractNegotiations?.['player-1']?.state, 'ready');
});
