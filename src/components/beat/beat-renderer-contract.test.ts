import assert from 'node:assert/strict';
import test from 'node:test';
import stories from './__fixtures__/all-team-stories.json';
import { adaptBeatStory, type BeatStoryInput } from './beat-story-adapter';
import { validBeatGraphic, beatPalette } from './beat-model';

test('all 32 teams have eight reviewed feed inputs with valid composition contracts and evidence', () => {
  assert.equal(new Set(stories.map((s) => s.teamAbbr)).size, 32);
  assert.equal(stories.length, 256);
  for (const story of stories) {
    const d = adaptBeatStory(story);
    assert(validBeatGraphic(d.graphic), story.headline);
    assert(beatPalette(story.teamAbbr).team);
    for (const e of d.evidence) {
      if (e.source === 'canonical') assert.equal(e.excerpt, story.teamAbbr);
      else if (e.source !== 'structured')
        assert((story[e.source] ?? '').includes(e.excerpt), story.headline + ': ' + e.field);
    }
    if (d.graphic.family.startsWith('standard')) assert(d.fallbackReason);
  }
});
const input = (headline: string, summary = '', teamAbbr = 'KC'): BeatStoryInput => ({
  id: headline,
  headline,
  summary,
  teamAbbr,
  category: 'ANALYSIS',
});
test('dynamic list descriptors and score ownership use explicit facts', () => {
  for (const [headline, count, descriptor] of [
    ['10 Quick Facts Following the Chiefs Win', '10', 'QUICK\nFACTS'],
    ['10 things said by coordinators', '10', 'THINGS\nSAID'],
    ['5 Things to Know', '5', 'THINGS\nTO KNOW'],
    ['3 Takeaways', '3', 'TAKEAWAYS'],
    ['3x3: Week 2 Seahawks vs Cardinals', '3×3', 'NAMES\nNUMBERS & NOTES'],
  ]) {
    assert.deepEqual(adaptBeatStory(input(headline)).graphic, {
      family: 'numbered',
      count,
      descriptor,
    });
  }
  assert.equal(
    adaptBeatStory(input('TWENTYMAN: Week 2 observations')).graphic.family.startsWith('standard'),
    true,
  );
  const d = adaptBeatStory(
    input('Chiefs Defeat Broncos in Dominant Fashion, 31–10, to Kick Off Season'),
  ).graphic;
  assert.deepEqual(d, {
    family: 'game-result',
    leftTeam: 'KC',
    rightTeam: 'DEN',
    leftScore: 31,
    rightScore: 10,
    final: 'FINAL',
  });
  assert.deepEqual(adaptBeatStory(input('Chiefs Defeat Colts, 33-30, in Overtime')).graphic, {
    family: 'game-result',
    leftTeam: 'KC',
    rightTeam: 'IND',
    leftScore: 33,
    rightScore: 30,
    final: 'FINAL · OT',
  });
});
test('secondary scores and role-only headlines do not fabricate primary events or player names', () => {
  assert(
    adaptBeatStory(
      input('Power Rankings: Where the 49ers Stand', 'Their 35-13 win over Dolphins', 'SF'),
    ).graphic.family.startsWith('standard'),
  );
  const signing = adaptBeatStory(
    input(
      'Ravens Sign Wide Receiver to Practice Squad',
      'Shedrick Jackson provides more receiver depth.',
      'BAL',
    ),
  ).graphic;
  assert.equal(signing.family, 'transaction');
  if (signing.family === 'transaction') {
    assert.equal(signing.name, 'Shedrick Jackson');
    assert.equal(signing.position, 'WR');
  }
  assert(
    adaptBeatStory(input('Ravens Sign Wide Receiver', '', 'BAL')).graphic.family.startsWith(
      'standard',
    ),
  );
  assert.equal(
    adaptBeatStory(input('Jets Sign WR Malik McClain and DL Jack Heflin', '', 'NYJ')).graphic
      .family,
    'transaction',
  );
  assert.equal(
    adaptBeatStory(input('Roster Moves: Jaguars Sign TE Brenden Bates', '', 'JAX')).graphic.family,
    'transaction',
  );
});
test('complete composition contracts reject missing required fields', () => {
  assert.equal(validBeatGraphic({ family: 'player', name: 'Player Name' }), false);
  assert.equal(validBeatGraphic({ family: 'interview', name: 'Speaker', transcript: true }), false);
  assert.equal(validBeatGraphic({ family: 'recap', teams: [] }), false);
  assert.equal(
    validBeatGraphic({ family: 'game-matchup', leftTeam: 'KC', rightTeam: 'UNK' }),
    false,
  );
  assert.equal(
    validBeatGraphic({ family: 'developing', updates: [{ time: '1 PM', detail: 'One update' }] }),
    false,
  );
  assert.equal(validBeatGraphic({ family: 'stats', descriptor: 'BY THE NUMBERS', rows: [] }), true);
  assert.equal(validBeatGraphic({ family: 'injury', rows: [], detail: 'INJURY\nREPORT' }), true);
});
test('mailbag, depth chart, practice and optional real kickoff use shared formats', () => {
  for (const headline of [
    "You've Got Mail",
    'Inbox: Fan questions',
    'Asked and Answered: Sept. 22',
  ])
    assert.equal(adaptBeatStory(input(headline)).graphic.family, 'mailbag');
  assert.equal(
    adaptBeatStory(input('Panthers release depth chart', '', 'CAR')).graphic.family,
    'depth-chart',
  );
  const matchup = adaptBeatStory(
    input('Game Preview: Raiders at Chargers in Week 2', 'Kickoff Sunday at 1:00 PM ET.', 'LV'),
  ).graphic;
  assert.equal(matchup.family, 'game-matchup');
  if (matchup.family === 'game-matchup') {
    assert.equal(matchup.kickoff, 'SUN · 1:00 PM ET');
    assert.equal(matchup.week, 'W2');
  }
});
