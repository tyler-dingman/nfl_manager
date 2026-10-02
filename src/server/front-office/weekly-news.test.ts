import test from 'node:test';
import assert from 'node:assert/strict';
import { createFranchiseSimulation, advanceSimulation } from '@/lib/franchise-simulation';
import { createFallbackRegularSeasonSchedule } from './calendar';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { generateFrontOfficeEvents } from './event-engine';
import { isFrontOfficeNewsNotification } from '@/lib/front-office-news-notifications';
import { eligibleNewsToasts, defaultNewsPreferences } from '@/lib/front-office-news-presentation';
import type { FrontOfficeEvent } from '@/types/front-office';

test('fresh full-league franchise accumulates meaningful news through Week 17, without opening News', () => {
  const teams = NFL_LEAGUE_DATA.teams.map((t) => ({
    abbr: t.abbr,
    conference: t.conference,
    division: t.division,
    overall: t.teamOverview ?? 80,
  }));
  const players = NFL_LEAGUE_DATA.players.map((p) => ({
    id: p.id,
    name: p.name,
    teamAbbr: p.teamAbbr,
    position: p.position,
    rating: p.rating,
  }));
  let current = createFranchiseSimulation({
    seed: 'news-season-qa',
    season: 2026,
    teams,
    games: createFallbackRegularSeasonSchedule(
      teams.map((t) => t.abbr),
      2026,
    ).map((g) => ({ ...g, homeTeam: g.homeTeam!, awayTeam: g.awayTeam! })),
  });
  const stored = new Map();
  const counts = [];
  for (let week = 1; week <= 17; week++) {
    const previous = current;
    current = advanceSimulation(previous, `week-${week + 1}`, { players, recapTeamAbbr: 'KC' });
    const events = generateFrontOfficeEvents({
      saveId: 'news-season-qa',
      teamAbbr: 'KC',
      previous,
      current,
    }).filter(isFrontOfficeNewsNotification);
    assert.deepEqual(
      events,
      generateFrontOfficeEvents({
        saveId: 'news-season-qa',
        teamAbbr: 'KC',
        previous,
        current,
      }).filter(isFrontOfficeNewsNotification),
    );
    for (const e of events) stored.set(e.id, e);
    counts.push({
      week,
      league: events.filter((e) => e.teamAbbr !== 'KC').length,
      team: events.filter((e) => e.teamAbbr === 'KC').length,
      total: stored.size,
    });
  }
  console.log('WEEKLY NEWS QA', JSON.stringify(counts));
  assert.ok(stored.size >= 40, `Expected substantial history, got ${stored.size}`);
  assert.ok(counts.find((c) => c.week === 9)!.league >= 7);
  assert.ok(counts.reduce((n, c) => n + c.team, 0) >= 8);
  const unchanged = generateFrontOfficeEvents({
    saveId: 'news-season-qa',
    teamAbbr: 'KC',
    previous: current,
    current,
  });
  assert.equal(unchanged.length, 0);
});
test('one grouped popup candidate batch preserves all stories and preferences only affect toasts', () => {
  const events = Array.from(
    { length: 3 },
    (_, i) =>
      ({
        id: `test${i}`,
        type: 'league_transaction',
        teamAbbr: 'KC',
        headline: `Roster move ${i}`,
        priority: 'normal',
        metadata: { newsCategory: 'TRANSACTION' },
      }) as unknown as FrontOfficeEvent,
  );
  assert.equal(eligibleNewsToasts(events, 'KC', defaultNewsPreferences).length, 3);
  assert.equal(
    eligibleNewsToasts(events, 'KC', { ...defaultNewsPreferences, frequency: 'minimal' }).length,
    0,
  );
  assert.equal(events.length, 3);
});
test('committed user release, signing, trade and contract retain stable IDs across weeks', () => {
  const initial = createFranchiseSimulation({
    seed: 'actions',
    season: 2026,
    teams: [],
    games: [],
  });
  const current = structuredClone(initial);
  current.transactions = ['cut', 'signing', 'trade', 're-sign'].map((type, i) => ({
    id: `committed-${i}`,
    type: type as 'cut',
    teamAbbr: 'KC',
    playerName: 'Test Player',
    summary: `Committed ${type}`,
    createdAt: new Date(0).toISOString(),
  }));
  const a = generateFrontOfficeEvents({ saveId: 'A', teamAbbr: 'KC', previous: initial, current });
  current.currentWeek = 5;
  const b = generateFrontOfficeEvents({ saveId: 'A', teamAbbr: 'KC', previous: initial, current });
  assert.deepEqual(
    a.map((e) => e.id),
    b.filter((e) => e.metadata.transactionId).map((e) => e.id),
  );
  assert.equal(new Set(a.map((e) => e.id)).size, 4);
  const other = generateFrontOfficeEvents({
    saveId: 'B',
    teamAbbr: 'KC',
    previous: initial,
    current,
  });
  assert.ok(other.every((e) => !a.some((x) => x.id === e.id)));
});

test('injury, return and starter stories require actual saved roster changes', async () => {
  const { rosterChangeNews } = await import('./roster-news');
  const previous = createFranchiseSimulation({
    seed: 'roster',
    season: 2026,
    teams: [],
    games: [],
  });
  const player = {
    id: 'p',
    firstName: 'Actual',
    lastName: 'Player',
    teamAbbr: 'KC',
    position: 'CB',
    status: 'Active',
    rating: 85,
    contractYearsRemaining: 1,
    capHit: '$2M',
  };
  const baseline = structuredClone(previous);
  assert.equal(rosterChangeNews('save', previous, baseline, [player]).length, 0);
  const injury = structuredClone(baseline);
  const injured = { ...player, status: 'Injured - ankle' };
  assert.equal(
    rosterChangeNews('save', baseline, injury, [injured])[0].metadata.newsCategory,
    'INJURY',
  );
  const returned = structuredClone(injury);
  assert.equal(
    rosterChangeNews('save', injury, returned, [player])[0].metadata.newsCategory,
    'RETURN',
  );
  assert.equal(
    rosterChangeNews('save', returned, structuredClone(returned), [
      { ...player, status: 'Starter' },
    ])[0].metadata.newsCategory,
    'DEPTH CHART',
  );
});

test('postseason advancement and offseason contract coverage use real saved facts', async () => {
  const { phaseNews } = await import('./phase-news');
  const before = createFranchiseSimulation({ seed: 'post', season: 2026, teams: [], games: [] });
  const after = structuredClone(before);
  after.phase = 'offseason';
  after.draftOrder = ['CHI', 'KC', 'BAL'];
  const player = {
    id: 'p',
    firstName: 'Actual',
    lastName: 'Veteran',
    teamAbbr: 'KC',
    position: 'CB',
    status: 'Active',
    rating: 85,
    contractYearsRemaining: 1,
    capHit: '$2M',
  };
  const events = phaseNews({
    saveId: 'post',
    teamAbbr: 'KC',
    previous: before,
    current: after,
    roster: [player],
  });
  assert.ok(events.some((e) => e.metadata.newsCategory === 'CONTRACT' && e.playerId === 'p'));
  assert.ok(events.some((e) => e.metadata.newsCategory === 'DRAFT' && e.headline.includes('CHI')));
  assert.equal(
    phaseNews({ saveId: 'post', teamAbbr: 'KC', previous: after, current: after, roster: [player] })
      .length,
    0,
  );
});

test('deadline rumors require an actual expiring veteran on a losing team', async () => {
  const { weeklyNews } = await import('./weekly-news');
  const previous = createFranchiseSimulation({
    seed: 'market',
    season: 2026,
    teams: [
      { abbr: 'KC', conference: 'AFC', division: 'West', overall: 85 },
      { abbr: 'CHI', conference: 'NFC', division: 'North', overall: 75 },
    ],
    games: Array.from({ length: 7 }, (_, i) => ({
      id: `g${i}`,
      week: i + 1,
      homeTeam: 'KC',
      awayTeam: 'CHI',
    })),
  });
  const current = structuredClone(previous);
  current.currentWeek = 8;
  current.phase = 'week-8';
  current.games = current.games.map((g) => ({
    ...g,
    played: true,
    homeScore: 28,
    awayScore: 10,
    winner: 'KC',
  }));
  previous.games = current.games.map((g) =>
    g.week === 7 ? { ...g, played: false, winner: null, homeScore: null, awayScore: null } : g,
  );
  const roster = [
    {
      id: 'veteran',
      firstName: 'Actual',
      lastName: 'Veteran',
      teamAbbr: 'CHI',
      position: 'WR',
      status: 'Active',
      rating: 80,
      age: 30,
      contractYearsRemaining: 1,
      capHit: '$2M',
    },
  ];
  const stories = weeklyNews({ saveId: 'market', teamAbbr: 'KC', previous, current, roster });
  assert.ok(stories.some((e) => e.metadata.newsCategory === 'RUMOR' && e.playerId === 'veteran'));
  assert.ok(
    !weeklyNews({ saveId: 'market', teamAbbr: 'KC', previous, current, roster: [] }).some(
      (e) => e.metadata.newsCategory === 'RUMOR',
    ),
  );
});
