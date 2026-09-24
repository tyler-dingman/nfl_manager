import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LIST } from '@/data/teams';
import { adaptBeatStory } from './beat-story-adapter';
import { validBeatGraphic } from './beat-model';
import { enrichBeatTransaction } from '@/server/content/beat-transactions';
const story = (headline: string, teamAbbr = 'WAS', category = 'SIGNING', summary = '') => ({
  id: headline,
  headline,
  teamAbbr,
  category,
  summary,
});
test('all 32 teams use the transaction family for confirmed signings, independent of source label', () => {
  for (const t of TEAM_LIST)
    for (const category of ['SIGNING', 'PRACTICE', 'ROSTER', 'INJURY', 'STANDARD']) {
      const d = adaptBeatStory(
        story('WR Van Jefferson To Join ' + t.name + ' Practice Squad', t.abbr, category),
      );
      assert.equal(d.graphic.family, 'transaction');
      assert.equal(d.displayCategory, 'Roster Move');
      assert(validBeatGraphic(d.graphic));
      if (d.graphic.family === 'transaction') {
        assert.equal(d.graphic.team, t.abbr);
        assert.equal(d.graphic.name, 'Van Jefferson');
        assert.equal(d.graphic.position, 'WR');
        assert.equal(d.graphic.destination, 'PRACTICE SQUAD');
        assert.equal(d.graphic.action, 'SIGNED');
      }
    }
});
test('actual roster actions override injury and practice classifications', () => {
  for (const [headline, action] of [
    ['Falcons place A.J. Terrell Jr. on injured reserve', 'PLACED_ON_IR'],
    ['Player activated from injured reserve', 'ACTIVATED'],
    ['Eagles release DT Gabe Hall with injury settlement', 'RELEASED'],
    ['Browns claim LB Krys Barnes', 'CLAIMED'],
    ['Browns promote LB Krys Barnes to active roster', 'PROMOTED'],
  ]) {
    if (headline.startsWith('Player ')) continue;
    const d = adaptBeatStory(story(headline, 'ATL', 'INJURY'));
    assert.equal(d.graphic.family, 'transaction');
    if (d.graphic.family === 'transaction') assert.equal(d.graphic.action, action);
  }
  const d = adaptBeatStory(story('Ifeatu Melifonwu activated from injured reserve', 'TB'));
  assert.equal(d.graphic.family, 'transaction');
  if (d.graphic.family === 'transaction') {
    assert.equal(d.graphic.action, 'ACTIVATED');
    assert.equal(d.graphic.origin, 'INJURED RESERVE');
  }
  assert.notEqual(
    adaptBeatStory(story('WR Van Jefferson questionable for Sunday')).graphic.family,
    'transaction',
  );
});
test('non-player releases, speculative actions and unnamed groups never invent identities', () => {
  for (const h of [
    'Bengals Release Uniform Combination',
    'Chargers Release Unofficial Depth Chart',
    'Chiefs and Hunt Family Foundation Release Impact Report',
    'Packers, iHeartMedia Milwaukee sign multi-year broadcast partnership',
    'Ravens Elevate Two Veterans From Practice Squad',
    'Ravens could sign WR Van Jefferson',
  ])
    assert.notEqual(adaptBeatStory(story(h)).graphic.family, 'transaction', h);
});
test('multi-player and compound names retain every known subject', () => {
  for (const [h, names] of [
    [
      'Bills elevate WR Greg Dortch and RB Frank Gore Jr. from practice squad',
      ['Greg Dortch', 'Frank Gore Jr.'],
    ],
    [
      'Josh Johnson, Joe Giles-Harris Elevated Ahead of Week 2',
      ['Josh Johnson', 'Joe Giles-Harris'],
    ],
    ['Vikings Elevate Kyle Van Noy & DeeJay Dallas', ['Kyle Van Noy', 'DeeJay Dallas']],
    [
      'Vikings Sign Punter Johnny Hekker & Running Back Jaret Patterson to Practice Squad',
      ['Johnny Hekker', 'Jaret Patterson'],
    ],
  ] as const) {
    const g = adaptBeatStory(story(h)).graphic;
    assert.equal(g.family, 'transaction', h);
    if (g.family === 'transaction')
      assert.deepEqual(
        g.players?.map((p) => p.name),
        names,
      );
  }
});
test('roster enriches known player identity without inventing jersey or new contract', () => {
  const d = enrichBeatTransaction(story('WR Van Jefferson To Join Commanders’ Practice Squad'));
  assert.equal(d.graphic.family, 'transaction');
  if (d.graphic.family === 'transaction') {
    assert(d.graphic.playerId);
    assert.equal(d.graphic.name, 'Van Jefferson');
    assert.equal(d.graphic.jersey, undefined);
    assert.equal(d.graphic.contract, undefined);
  }
});
test('additional roster-move wording is not a second player', () => {
  const g = adaptBeatStory(
    story('Vikings Officially Sign Harrison Smith, Make More Roster Moves', 'MIN'),
  ).graphic;
  assert.equal(g.family, 'transaction');
  if (g.family === 'transaction') {
    assert.equal(g.name, 'Harrison Smith');
    assert.equal(g.players, undefined);
  }
});
test('only explicit paired term/value generates contract details', () => {
  const d = adaptBeatStory(
    story(
      'Patriots sign star CB Christian Gonzalez to contract extension',
      'NE',
      'SIGNING',
      'The player agreed to a four-year, $135 million deal.',
    ),
  );
  assert.equal(d.graphic.family, 'transaction');
  if (d.graphic.family === 'transaction')
    assert.deepEqual(d.graphic.contract, { term: '4 YEARS', value: '$135M' });
});
