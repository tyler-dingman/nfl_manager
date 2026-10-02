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
  const advanced = advanceSimulation(initial, 'week-2');
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
  const advanced = advanceSimulation(initial, 'week-2');
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
  let advanced = initial;
  for (let week = 2; week <= 18; week += 1) advanced = advanceSimulation(advanced, `week-${week}`);
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

test('fresh saves and unchanged timelines generate no league news', () => {
  const initial = createFranchiseSimulation({ seed: 'fresh', season: 2026, teams, games: [] });
  assert.deepEqual(
    generateFrontOfficeEvents({
      saveId: 'fresh',
      teamAbbr: 'CHI',
      previous: initial,
      current: initial,
    }),
    [],
  );
});

test('same simulation in different saves has disjoint event IDs; routine recaps are not breaking', () => {
  const initial = createFranchiseSimulation({
    seed: 'shared',
    season: 2026,
    teams,
    games: [{ id: 'game', week: 1, homeTeam: 'CHI', awayTeam: 'GB' }],
  });
  const current = advanceSimulation(initial, 'week-2');
  const a = generateFrontOfficeEvents({ saveId: 'A', teamAbbr: 'CHI', previous: initial, current });
  const b = generateFrontOfficeEvents({ saveId: 'B', teamAbbr: 'CHI', previous: initial, current });
  assert.ok(a.every((event) => !b.some((other) => event.id === other.id)));
  assert.ok(a.every((event) => event.type !== 'breaking_news' && !event.metadata.isBreaking));
});

test('sparse weeks do not invent news and transaction labels preserve the source facts', () => {
  const previous = createFranchiseSimulation({ seed: 'empty', season: 2026, teams, games: [] });
  const current = advanceSimulation(previous, 'week-2');
  current.transactions = [
    {
      id: 'trade',
      type: 'trade',
      teamAbbr: 'CHI',
      relatedTeamAbbr: 'GB',
      playerName: 'Star receiver',
      playerRating: 94,
      summary: 'CHI acquires Star receiver from GB',
      createdAt: new Date(0).toISOString(),
    },
  ];
  const news = generateFrontOfficeEvents({
    saveId: 'A',
    teamAbbr: 'CHI',
    previous,
    current,
  }).filter((e) => e.metadata.channel !== 'MESSAGE');
  assert.equal(news.length, 1);
  assert.equal(news[0].metadata.isBreaking, true);
  assert.equal(news[0].relatedTeamAbbr, 'GB');
  assert.equal(news[0].headline, current.transactions[0].summary);
});

test('all committed transactions persist even when the popup budget is one', () => {
  const previous = createFranchiseSimulation({ seed: 'budget', season: 2026, teams, games: [] });
  previous.currentWeek = 8;
  previous.phase = 'week-9';
  const current = structuredClone(previous);
  current.currentWeek = 9;
  current.phase = 'week-10';
  current.transactions = Array.from({ length: 12 }, (_, i) => ({
    id: `tx-${i}`,
    type: 'signing' as const,
    teamAbbr: 'CHI',
    summary: `CHI signs Player ${i}`,
    createdAt: new Date(0).toISOString(),
  }));
  const events = generateFrontOfficeEvents({
    saveId: 'budget-save',
    teamAbbr: 'CHI',
    previous,
    current,
  });
  const notifications = events.filter(
    (e) => e.metadata.channel !== 'MESSAGE' && e.metadata.newsCategory !== 'GAME_RECAP',
  );
  assert.equal(notifications.length, 12);
  assert.ok(notifications.every((e) => e.metadata.transactionId));
});
