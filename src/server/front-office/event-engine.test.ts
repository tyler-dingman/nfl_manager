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
  assert.equal(first.filter((event) => event.dedupeKey === 'game-result:g1').length, 1);
  assert.equal(
    first.find((event) => event.dedupeKey === 'game-result:g1')?.metadata.newsCategory,
    'GAME_RECAP',
  );
});

test('front office event engine caps non-game alerts while preserving game news', () => {
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
  assert.ok(events.filter((event) => !event.dedupeKey.startsWith('game-result:')).length <= 3);
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

test('trade deadline alert is anchored to Tuesday after Week 9', () => {
  const initial = createFranchiseSimulation({ seed: 'deadline', season: 2026, teams, games: [] });
  const previous = { ...initial, currentWeek: 8 };
  const current = { ...initial, currentWeek: 9, phase: 'week-9' };
  const events = generateFrontOfficeEvents({
    saveId: 'save',
    teamAbbr: 'CHI',
    previous,
    current,
  });
  const deadline = events.find((event) => event.type === 'deadline_alert');
  assert.match(deadline?.summary ?? '', /Tuesday after Week 9 at 4:00 p\.m\. ET/);
  assert.equal(deadline?.metadata.deadlineWeek, 9);
});
