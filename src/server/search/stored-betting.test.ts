import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SportsGameOddsClient } from '@/server/providers/sportsGameOdds';
import { answerSearch, type AnswerDependencies } from './answer-engine';
import { getStoredGameOdds, type OddsLine } from './stored-betting';
import { classifyIntent } from './intent';
import type { SearchGame } from '@/features/search/answer-types';
const now = new Date('2026-09-19T12:00:00Z');
const game: SearchGame = {
  id: 'espn-1',
  home: 'KC',
  away: 'IND',
  startsAt: '2026-09-21T00:20:00Z',
  status: 'scheduled',
  week: 2,
  venue: null,
  network: null,
  timeTbd: false,
  homeScore: null,
  awayScore: null,
  source: { id: 'game', title: 'Schedule', url: 'https://www.espn.com' },
};
const line = (market: string, selection: string, value: number | null, price = -110): OddsLine => ({
  market,
  selection,
  line: value,
  price,
  sportsbook: 'FANDUEL',
  updatedAt: '2026-09-19T06:00:00Z',
  eventId: 'stored-1',
});
const stored = [
  line('TOTAL', 'OVER', 47.5),
  line('TOTAL', 'UNDER', 47.5),
  line('SPREAD', 'KC', -3.5),
  line('SPREAD', 'IND', 3.5),
  line('MONEYLINE', 'KC', null, -175),
  line('MONEYLINE', 'IND', null, 150),
  { ...line('PASSING_YARDS', 'OVER', 250.5), playerName: 'Patrick Mahomes' },
];
const deps = (odds = stored): AnswerDependencies => ({
  loadSchedule: async () => [game],
  loadOdds: async () => odds,
  loadRoster: async () => ({ players: [], source: game.source }),
  loadStandings: async () => ({ rows: [], source: game.source }),
  loadInjuries: async () => ({ rows: [], source: game.source }),
  loadNews: async () => [],
  loadStats: async () => ({ columns: [], rows: [], throughWeek: null }),
  loadTransactions: async () => [],
  classify: async () => null,
  synthesize: async () => null,
});

test('stored-only search handles totals, spread, favored, snapshots and props repeatedly with ZERO provider calls', async (t) => {
  const spies = ['getEvent', 'getNflEvents', 'getUsage'].map((method) =>
    t.mock.method(SportsGameOddsClient.prototype, method as 'getEvent', async () => {
      throw new Error('Search must not call odds provider');
    }),
  );
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const [query, expected] of [
      ['What is the over under?', /47\.5/],
      ["What's the spread?", /-3\.5/],
      ['Are the Chiefs favored?', /Yes.*Kansas City Chiefs are favored/],
      ['Who is favored?', /Kansas City Chiefs are favored/],
      ['What are the odds?', /OVER.*UNDER|KC.*IND/],
      ['Mahomes passing yard odds?', /Patrick Mahomes.*250\.5/],
      ["What's Mahomes passing line?", /Patrick Mahomes/],
    ] as const) {
      const answer = await answerSearch({ query, teamId: 'KC' }, deps(), now);
      assert.match(answer.lead!, expected);
      assert.match(answer.lead!, /last updated/);
      assert.match(answer.lead!, /6 hours old/);
      assert.equal(answer.context?.lastReferencedGame, game.id);
      if (query === 'What are the odds?') {
        const card = answer.blocks?.find((b) => b.type === 'oddsCard');
        assert.ok(card?.type === 'oddsCard');
        assert.deepEqual(
          new Set(card.lines.map((l) => l.market)),
          new Set(['SPREAD', 'MONEYLINE', 'TOTAL']),
        );
      }
    }
    const missing = await answerSearch({ query: 'over under', teamId: 'KC' }, deps([]), now);
    assert.match(missing.lead!, /don't have a stored betting line/);
    const wrongPlayer = await answerSearch(
      { query: 'Kelce passing prop', teamId: 'KC' },
      deps(),
      now,
    );
    assert.match(wrongPlayer.lead!, /don't have a stored player prop/);
    const regular = await answerSearch({ query: 'When do they play?', teamId: 'KC' }, deps(), now);
    assert.equal(regular.answerType, 'NEXT_GAME');
  }
  for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
});

test('database reader only SELECTs existing storage and retains selection/price timestamp', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No network in betting reader');
  });
  let sql = '';
  const db = async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    sql = strings.join('?');
    return [
      {
        event_id: 'stored',
        market_type: 'TOTAL',
        side: 'OVER',
        team_id: 'KC',
        line: '47.5',
        odds: -110,
        sportsbook: 'FANDUEL',
        updated_at: new Date('2026-09-19T06:00:00Z'),
      },
    ];
  };
  const rows = await getStoredGameOdds(
    game,
    db as unknown as Parameters<typeof getStoredGameOdds>[1],
  );
  assert.match(sql, /SELECT/);
  assert.doesNotMatch(sql, /INSERT|UPDATE |DELETE|refresh/i);
  assert.equal(rows[0].selection, 'OVER');
  assert.equal(rows[0].line, 47.5);
  assert.equal(rows[0].updatedAt, '2026-09-19T06:00:00.000Z');
  assert.equal(network.mock.callCount(), 0);
  // Import allowlist prevents a future cache-miss fallback from importing ingestion.
  const sourceText = readFileSync(new URL('./stored-betting.ts', import.meta.url), 'utf8');
  const imports = [...sourceText.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual(imports, [
    '@/server/auth/database',
    '@/features/search/answer-types',
    '@/server/odds/sportsbooks',
  ]);
});

test('betting analysis and player props route before article retrieval', () => {
  for (const q of [
    'Mahomes passing yard odds?',
    'Mahomes passing prop',
    "What are Kelce's receiving props?",
    'What are the touchdown odds?',
    'What props are available?',
  ])
    assert.equal(classifyIntent(q), 'PLAYER_PROPS', q);
  for (const q of [
    'How often have the Chiefs gone over this year?',
    'How often has Mahomes cleared 250 yards?',
    'How has Kelce done against this opponent?',
    'Is the Chiefs offense trending over?',
  ])
    assert.equal(classifyIntent(q), 'BETTING_ANALYSIS', q);
  assert.equal(classifyIntent('What are the betting lines?'), 'ODDS');
});
