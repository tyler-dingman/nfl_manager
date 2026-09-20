import { usableStoredOdds as freshOdds } from './stored-betting';
import assert from 'node:assert/strict';
import test from 'node:test';
import { answerSearch, type AnswerDependencies } from './answer-engine';
import { buildInformationPlan, classifyIntent } from './intent';
import { rankBriefingEvidence, validateSynthesis } from './evidence';
import { normalizeSearchGame, type NewsEvidence } from './answer-data';
import type { SearchGame } from '@/features/search/answer-types';
const now = new Date('2026-09-19T12:00:00Z');
const game = (id: string, startsAt: string, away: string): SearchGame => ({
  id,
  startsAt,
  home: 'KC',
  away,
  week: 2,
  venue: 'Test Stadium',
  network: 'NBC',
  status: 'scheduled',
  homeScore: null,
  awayScore: null,
  timeTbd: false,
  source: {
    id: `game:${id}`,
    title: 'Test game',
    provider: 'ESPN',
    url: `https://www.espn.com/nfl/game/_/gameId/${id}`,
  },
});
const games = [
  game('one', '2026-09-21T00:20:00Z', 'IND'),
  game('two', '2026-09-27T17:00:00Z', 'MIA'),
];
const deps = (overrides: Partial<AnswerDependencies> = {}): AnswerDependencies => ({
  loadSchedule: async () => games,
  loadStandings: async () => ({
    rows: [],
    source: { id: 'standings', title: 'Standings', url: 'https://www.espn.com/nfl/standings' },
  }),
  loadRoster: async () => ({
    players: [],
    source: { id: 'roster', title: 'Roster', url: 'https://www.espn.com/' },
  }),
  loadInjuries: async () => ({
    rows: [],
    source: { id: 'injuries', title: 'Injuries', url: 'https://www.espn.com/' },
  }),
  loadOdds: async () => [],
  loadNews: async () => [],
  loadTransactions: async () => [],
  loadStats: async () => ({ columns: [], rows: [], throughWeek: null }),
  synthesize: async () => null,
  classify: async () => null,
  ...overrides,
});

test('deterministic router recognizes factual and editorial intent', () => {
  const cases = {
    'When do the Chiefs play?': 'NEXT_GAME',
    'When do they play?': 'NEXT_GAME',
    'Who do they play after that?': 'FOLLOW_UP',
    'What is the over under?': 'TOTAL',
    'o/u': 'TOTAL',
    'What’s the spread?': 'SPREAD',
    moneyline: 'MONEYLINE',
    schedule: 'SCHEDULE',
    'Who is hurt?': 'INJURIES',
    'Is Mansoor Delane playing?': 'PLAYER_STATUS',
    'Latest roster moves': 'TRANSACTIONS',
    'Catch me up.': 'TEAM_BRIEFING',
    'What did I miss?': 'TEAM_BRIEFING',
    'Playoff outlook': 'PLAYOFF_OUTLOOK',
    'Rookie impact': 'PLAYER_STATS',
    'draft picks': 'DRAFT_PICKS',
  };
  for (const [q, intent] of Object.entries(cases)) assert.equal(classifyIntent(q), intent, q);
});
test('next game, total, and after-that retain the same resolved game context', async () => {
  let oddsGame = '';
  let newsCalls = 0;
  const d = deps({
    loadNews: async () => {
      newsCalls++;
      return [];
    },
    loadOdds: async (g) => {
      oddsGame = g.id;
      return [
        {
          market: 'TOTAL',
          selection: 'over',
          line: 46.5,
          price: -110,
          sportsbook: 'FANDUEL',
          updatedAt: '2026-09-19T11:30:00Z',
        },
      ];
    },
  });
  const first = await answerSearch(
    { query: 'When do the Chiefs play?', teamId: 'KC', timeZone: 'America/Chicago' },
    d,
    now,
  );
  assert.match(first.lead!, /Chiefs host the Indianapolis Colts/);
  assert.match(first.lead!, /7:20 PM CDT/);
  assert.equal(first.context?.lastReferencedGame, 'one');
  const second = await answerSearch(
    { query: 'What is the over under?', teamId: 'KC', context: first.context },
    d,
    now,
  );
  assert.equal(oddsGame, 'one');
  assert.match(second.lead!, /46.5/);
  assert.equal(second.blocks?.[0].type, 'oddsCard');
  assert.equal(second.sources[0].updatedAt, '2026-09-19T11:30:00Z');
  const third = await answerSearch(
    { query: 'Who do they play after that?', teamId: 'KC', context: second.context },
    d,
    now,
  );
  assert.equal(third.context?.lastReferencedGame, 'two');
  assert.match(third.lead!, /Miami Dolphins/);
  assert.equal(newsCalls, 0);
});
test('missing structured data never falls back to vaguely related articles', async () => {
  let calls = 0;
  const r = await answerSearch(
    { query: 'When do the Chiefs play?', teamId: 'KC' },
    deps({
      loadSchedule: async () => {
        throw Error('offline');
      },
      loadNews: async () => {
        calls++;
        throw Error('must not be called');
      },
    }),
    now,
  );
  assert.match(r.lead!, /isn't available/);
  assert.equal(calls, 0);
  assert.deepEqual(r.results, []);
  assert.deepEqual(r.availability?.unavailable, ['schedule']);
});
test('older stored totals are disclosed; future-dated and null totals are refused', async () => {
  const lines = [
    {
      market: 'TOTAL',
      selection: 'over',
      line: 46.5,
      price: -110,
      sportsbook: 'FANDUEL',
      updatedAt: '2026-09-18T11:30:00Z',
    },
    {
      market: 'TOTAL',
      selection: 'under',
      line: null,
      price: -110,
      sportsbook: 'FANDUEL',
      updatedAt: now.toISOString(),
    },
  ];
  assert.deepEqual(freshOdds(lines, now), [lines[0]]);
  const result = await answerSearch(
    { query: 'total', teamId: 'KC' },
    deps({ loadOdds: async () => lines }),
    now,
  );
  assert.match(result.lead!, /stored/);
  assert.match(result.lead!, /hours old/);
  assert.equal(result.blocks?.[0].type, 'oddsCard');
  assert.deepEqual(freshOdds([{ ...lines[0], updatedAt: '2027-01-01T00:00:00Z' }], now), []);
});
test('team switches clear old game references; client facts are never trusted', () => {
  const context = { selectedTeamId: 'KC', currentTeam: 'KC', lastReferencedGame: 'one' };
  assert.equal(buildInformationPlan('over under', 'CHI', context).referenceGame, undefined);
  assert.equal(buildInformationPlan('When do the Bears play?', 'KC', context).teamId, 'CHI');
  assert.equal(buildInformationPlan('Who do they play after that?', 'KC').ambiguous, true);
});
test('unknown referenced game does not silently select a different betting event', async () => {
  const r = await answerSearch(
    {
      query: 'over under',
      teamId: 'KC',
      context: { selectedTeamId: 'KC', currentTeam: 'KC', lastReferencedGame: 'missing' },
    },
    deps(),
    now,
  );
  assert.match(r.lead!, /don't have a stored betting line/);
});
test('score zero is preserved and TBD kickoff is not invented', () => {
  const g = normalizeSearchGame(
    {
      id: 'a',
      date: '2026-09-21T00:00Z',
      timeValid: false,
      competitions: [
        {
          status: { type: { completed: true } },
          competitors: [
            { homeAway: 'home', team: { abbreviation: 'KC' }, score: { value: 0 } },
            { homeAway: 'away', team: { abbreviation: 'WSH' }, score: { value: 7 } },
          ],
        },
      ],
    },
    now.toISOString(),
  );
  assert.equal(g?.homeScore, 0);
  assert.equal(g?.away, 'WAS');
  assert.equal(g?.timeTbd, true);
  assert.equal(g?.status, 'final');
});
const news = (id: string, age: number, tier = 'A'): NewsEvidence => ({
  id,
  title: `Player ${id} injury update`,
  summary: 'The player is listed as questionable.',
  category: 'INJURY',
  entities: [id],
  publishedAt: new Date(now.getTime() - age * 3600000).toISOString(),
  importance: 75,
  independentSources: 1,
  sources: [
    {
      id,
      title: 'Original reporting',
      url: `https://example.com/${id}`,
      provider: 'Reporter',
      tier,
      reliability: 0.95,
    },
  ],
});
test('briefing expands recency gradually, clusters duplicate developments, excludes weak/stale sources', () => {
  const selected = rankBriefingEvidence(
    [
      news('a', 2),
      { ...news('duplicate', 3), entities: ['a'] },
      news('b', 30),
      news('old', 90),
      news('weak', 1, 'C'),
    ],
    now,
  );
  assert.equal(selected.windowHours, 72);
  assert.equal(selected.news.length, 2);
  assert.equal(selected.news[0].sources.length, 2);
  assert.ok(selected.news.every((n) => !['old', 'weak'].includes(n.id)));
});
test('claim validation rejects fabricated citations, quotes, numbers and named entities', () => {
  const evidence = [{ id: 'a', content: 'Patrick Mahomes threw for 250 yards.' }];
  const valid = {
    text: 'Patrick Mahomes threw for 250 yards.',
    evidenceIds: ['a'],
    quotes: ['Patrick Mahomes threw for 250 yards.'],
  };
  assert.equal(validateSynthesis([valid], evidence), true);
  for (const bad of [
    { ...valid, evidenceIds: ['missing'] },
    { ...valid, quotes: ['He threw for 600 yards.'] },
    { ...valid, text: 'Patrick Mahomes threw for 900 yards.' },
    { ...valid, text: 'Josh Allen threw for 250 yards.' },
  ])
    assert.equal(validateSynthesis([bad], evidence), false);
});
test('ambiguous player status does not claim the first matched player is playing', async () => {
  const r = await answerSearch(
    { query: 'Is Smith playing?', teamId: 'KC' },
    deps({
      loadInjuries: async () => ({
        rows: [
          {
            name: 'John Smith',
            status: 'Out',
            position: 'WR',
            detail: '',
            date: now.toISOString(),
          },
          {
            name: 'Sam Smith',
            status: 'Questionable',
            position: 'CB',
            detail: '',
            date: now.toISOString(),
          },
        ],
        source: { id: 'injuries', title: 'Injuries', url: 'https://www.espn.com/' },
      }),
    }),
    now,
  );
  assert.match(r.lead!, /Which player/);
});

test('follow-up team change preserves intent, but never the old game', () => {
  const p = buildInformationPlan('What about the Bears?', 'KC', {
    selectedTeamId: 'KC',
    currentTeam: 'KC',
    lastIntent: 'NEXT_GAME',
    lastReferencedGame: 'one',
  });
  assert.equal(p.intent, 'NEXT_GAME');
  assert.equal(p.teamId, 'CHI');
  assert.equal(p.referenceGame, undefined);
  assert.equal(classifyIntent('offensive line news'), 'NEWS');
  assert.equal(classifyIntent('total passing yards'), 'PLAYER_STATS');
});
test('transaction questions use official records before related coverage', async () => {
  const r = await answerSearch(
    { query: 'Latest roster moves', teamId: 'KC' },
    deps({
      loadTransactions: async () => [
        {
          name: 'Test Player',
          date: '2026-09-18',
          from: null,
          to: 'KC',
          description: 'Free Agent Signing',
          source: {
            id: 'official',
            title: 'Ledger',
            url: 'https://www.nfl.com/transactions',
            provider: 'NFL.com',
          },
        },
      ],
    }),
    now,
  );
  assert.match(r.lead!, /Test Player/);
  assert.equal(r.blocks?.[0].type, 'transactionList');
  assert.equal(r.sources[0].provider, 'NFL.com');
});

test('shared team entities do not merge unrelated injuries', () => {
  const selected = rankBriefingEvidence(
    [
      { ...news('a', 1), entities: ['Kansas City Chiefs', 'KC', 'Player One'] },
      { ...news('b', 2), entities: ['Kansas City Chiefs', 'KC', 'Player Two'] },
    ],
    now,
  );
  assert.equal(selected.news.length, 2);
});
