import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFranchiseSimulation,
  startFranchiseAtWeekOne,
} from '../../src/lib/franchise-simulation';
import { selectHeroStory, buildHeroCandidates, type HeroContext } from './hero-story';
function context(week = 1): HeroContext {
  const state = startFranchiseAtWeekOne(
    createFranchiseSimulation({
      seed: 'qa',
      season: 2026,
      teams: [
        { abbr: 'KC', conference: 'AFC', division: 'West', overall: 85 },
        { abbr: 'LV', conference: 'AFC', division: 'West', overall: 70 },
      ],
      games: [{ id: 'g1', week: 1, homeTeam: 'KC', awayTeam: 'LV' }],
    }),
  );
  state.phase = `week-${week}`;
  state.currentWeek = week - 1;
  return {
    state,
    team: 'KC',
    stadium: '/existing-stadium.png',
    players: [
      { id: 'qb', name: 'Test QB', position: 'QB', rating: 83, age: 24, image: '/existing-qb.png' },
    ],
    targets: [],
    freeAgents: [],
    prospects: [],
    needs: ['WR'],
    offers: [],
    deadlineWeek: 9,
  };
}
function strong(c: HeroContext) {
  c.state.games[0] = {
    ...c.state.games[0],
    played: true,
    homeScore: 28,
    awayScore: 7,
    result: {
      playerStats: [
        { playerId: 'qb', teamAbbr: 'KC', passingYards: 320, passingTD: 3, interceptions: 0 },
      ],
    } as never,
  };
  return c;
}
test('all 18 weeks have a relevant fallback and local CTA', () => {
  for (let w = 1; w <= 18; w++) {
    const story = selectHeroStory(context(w));
    assert.ok(story);
    assert.equal(story.week, w);
    assert.ok(story.href.startsWith('/'));
    if (w >= 15) assert.equal(story.category, 'playoffs');
  }
});
test('opening dialogue is explicitly simulated; missing coach uses stadium', () => {
  const c = context();
  assert.equal(selectHeroStory(c)?.headline, 'THE WAIT IS OVER');
  assert.equal(selectHeroStory(c)?.simulatedDialogue, true);
  assert.equal(selectHeroStory(c)?.visualType, 'stadium');
  c.coach = { id: 'coach', name: 'Coach', image: '/existing-coach.png' };
  assert.equal(selectHeroStory(c)?.visualType, 'coach');
});
test('no mediocre QB claim; strong stats qualify; missing image rejects people', () => {
  const c = context(2);
  assert.ok(!buildHeroCandidates(c).some((x) => x.templateId === 'qb-hot-start'));
  strong(c);
  assert.ok(buildHeroCandidates(c).some((x) => x.templateId === 'qb-hot-start'));
  c.players[0].image = null;
  assert.ok(!buildHeroCandidates(c).some((x) => x.visualType === 'player'));
});
test('fixed seed repeats, different seeds vary among relevant candidates', () => {
  const c = strong(context(3));
  c.freeAgents = [{ id: 'fa', name: 'Available WR', position: 'WR', rating: 81, image: '/fa.png' }];
  assert.deepEqual(selectHeroStory(c), selectHeroStory(structuredClone(c)));
  const ids = new Set(
    Array.from({ length: 30 }, (_, i) => {
      c.state.seed = String(i);
      return selectHeroStory(c)?.templateId;
    }),
  );
  assert.ok(ids.size > 1);
});
test('development appears once when qualified, before the deadline arc', () => {
  const c = strong(context(4));
  const first = selectHeroStory(c)!;
  assert.equal(first.category, 'development');
  c.state.heroStories = { '2026:4': first };
  c.state.phase = 'week-5';
  assert.ok(!buildHeroCandidates(c).some((s) => s.category === 'development'));
});
test('deadline follows configured week and offers require actual offers', () => {
  const c = context(8);
  assert.ok(!buildHeroCandidates(c).some((s) => s.templateId === 'phone-ringing'));
  c.offers = [{ playerId: 'qb', count: 2 }];
  assert.ok(buildHeroCandidates(c).some((s) => s.templateId === 'phone-ringing'));
  c.deadlineWeek = 10;
  c.state.phase = 'week-10';
  assert.equal(selectHeroStory(c)?.headline, 'THE DEADLINE IS HERE');
});
test('postseason does not replace the existing playoff hero', () => {
  const c = context();
  c.state.phase = 'wild_card';
  assert.equal(selectHeroStory(c), null);
});

test('mathematically eliminated teams only receive future-focused stories', () => {
  const c = context(18);
  for (let i = 0; i < 8; i++) {
    const abbr = `T${i}`;
    c.state.teams[abbr] = { ...c.state.teams.LV, abbr };
    c.state.games.push({
      id: abbr,
      week: i + 1,
      seasonType: 'REG',
      homeTeam: abbr,
      awayTeam: 'KC',
      played: true,
      homeScore: 21,
      awayScore: 0,
      winner: abbr,
    });
  }
  c.state.games = c.state.games.filter((g) => g.id !== 'g1');
  const stories = buildHeroCandidates(c);
  assert.ok(stories.length > 0);
  assert.ok(stories.every((s) => !s.category.startsWith('playoff')));
  assert.equal(selectHeroStory(c)?.headline, 'WHAT COMES NEXT?');
});

test('facility visuals require a real weak grade, select weakest eligible area, and appear once', () => {
  for (const [visual, projectId] of [
    ['locker-room', 'amenities'],
    ['training-room', 'medical'],
    ['weight-room', 'weights'],
    ['cafeteria', 'nutrition'],
  ] as const) {
    const c = context(11);
    c.ownership = {
      attendance: 85,
      facility: 'Test facility',
      grade: 'D',
      sentiment: '',
      facilities: [
        { visual, projectId, name: visual, score: 50, grade: 'D', upgradeAvailable: true },
      ],
    };
    const story = selectHeroStory(c)!;
    assert.equal(story.visualType, visual);
    assert.equal(story.href, `/front-office/ownership/facilities#${projectId}`);
    assert.ok(story.image.endsWith('.png'));
    c.state.heroStories = { '2026:11': story };
    c.state.phase = 'week-12';
    assert.ok(!buildHeroCandidates(c).some((s) => s.category === 'facility'));
    c.state.heroStories = {};
    c.ownership.facilities![0].score = 90;
    assert.ok(!buildHeroCandidates(c).some((s) => s.category === 'facility'));
    c.ownership.facilities![0].score = 50;
    c.ownership.facilities![0].upgradeAvailable = false;
    assert.ok(!buildHeroCandidates(c).some((s) => s.category === 'facility'));
  }
  assert.ok(!buildHeroCandidates(context(11)).some((s) => s.category === 'facility'));
});
test('trade graphic is fallback; need-fit player and actual offers take precedence', () => {
  const c = context(7);
  assert.equal(selectHeroStory(c)?.visualType, 'trade-deadline');
  c.targets = [{ id: 'target', name: 'Target', position: 'WR', image: '/target.png' }];
  assert.equal(selectHeroStory(c)?.visualType, 'trade-player');
  c.offers = [{ playerId: 'qb', count: 1 }];
  assert.equal(selectHeroStory(c)?.templateId, 'phone-ringing');
});
test('generic draft uses actual needs/position; consecutive graphic loses to prospect', () => {
  const c = context(11);
  c.projectedPick = 12;
  const generic = buildHeroCandidates(c).find((s) => s.visualType === 'draft')!;
  assert.match(generic.body, /#12/);
  assert.match(generic.body, /WR/);
  c.state.heroStories = { '2026:11': generic };
  c.state.phase = 'week-12';
  c.prospects = [
    {
      id: 'prospect',
      name: 'Prospect',
      image: '/prospect.png',
      position: 'WR',
      rank: 8,
      priorRank: 12,
      low: 5,
      high: 15,
    },
  ];
  assert.equal(selectHeroStory(c)?.visualType, 'prospect');
});
test('three complete seeded seasons vary while preserving controlled arcs', () => {
  const sequences = ['A', 'B', 'C'].map((seed) => {
    const c = strong(context());
    c.state.seed = seed;
    c.freeAgents = [
      { id: 'fa', name: 'Available WR', position: 'WR', rating: 81, image: '/fa.png' },
    ];
    c.targets = [
      { id: 'target', name: 'Target WR', position: 'WR', rating: 85, image: '/target.png' },
    ];
    const sequence = [];
    for (let week = 1; week <= 18; week++) {
      c.state.phase = `week-${week}`;
      const story = selectHeroStory(c)!;
      if (week === 1) assert.equal(story.templateId, 'season-opening');
      if (week >= 6 && week <= 9) assert.equal(story.category, 'trade');
      if (week >= 15) assert.ok(story.category.startsWith('playoff'));
      c.state.heroStories = { ...c.state.heroStories, [`2026:${week}`]: story };
      sequence.push(story.templateId);
    }
    return sequence.join(',');
  });
  assert.ok(new Set(sequences).size > 1);
});

test('all 18 weeks change artwork even with sparse franchise data', () => {
  const c = context();
  let previousImage = '';
  for (let week = 1; week <= 18; week++) {
    c.state.phase = `week-${week}`;
    c.state.currentWeek = week - 1;
    const story = selectHeroStory(c)!;
    assert.ok(story);
    assert.notEqual(story.image, previousImage, `repeated artwork in Week ${week}`);
    assert.deepEqual(selectHeroStory(c), story, 'refresh must not reroll the weekly hero');
    c.state.heroStories = { ...c.state.heroStories, [`2026:${week}`]: story };
    previousImage = story.image;
  }
});

test('image exclusion wins over story priority and ignores cache parameters', () => {
  const c = strong(context(5));
  const first = selectHeroStory(c)!;
  c.state.heroStories = { '2026:4': { ...first, week: 4, image: `${first.image}?v=old` } };
  const next = selectHeroStory(c)!;
  assert.notEqual(next.image.split('?')[0], first.image.split('?')[0]);
});

test('rotation uses the latest previous week, not insertion order or current cached story', () => {
  const c = context(8);
  const prior = selectHeroStory(context(7))!;
  c.state.heroStories = {
    '2026:7': prior,
    '2026:8': { ...prior, week: 8, image: '/current.png' },
    '2026:2': { ...prior, week: 2, image: '/older.png' },
  };
  assert.notEqual(selectHeroStory(c)?.image, prior.image);
});
