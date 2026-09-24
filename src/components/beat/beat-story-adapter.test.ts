import assert from 'node:assert/strict';
import test from 'node:test';
import live from './__fixtures__/live-stories.json';
import review from './__fixtures__/review-stories.json';
import { adaptBeatStory, type BeatStoryInput } from './beat-story-adapter';
import { validBeatGraphic } from './beat-model';

for (const story of review)
  test('review: ' + story.headline, () => {
    const result = adaptBeatStory(story);
    assert.equal(result.graphic.family.replace(/standard-.*/, 'standard'), story.expected);
    assert(validBeatGraphic(result.graphic), JSON.stringify(result.graphic));
    if (story.expected === 'standard') assert(result.fallbackReason);
  });
const liveExpected: Record<string, string[]> = {
  HOU: [
    'standard',
    'standard',
    'game-matchup',
    'standard',
    'roster-roundup',
    'game-matchup',
    'scouting',
    'scouting',
  ],
  MIA: [
    'numbered',
    'business-community',
    'recap',
    'roster-roundup',
    'game-matchup',
    'standard',
    'standard',
    'standard',
  ],
  BUF: ['game-matchup', 'injury', 'recap', 'numbered', 'game-result', 'player', 'player', 'injury'],
  CHI: [
    'business-community',
    'standard',
    'player',
    'standard',
    'business-community',
    'business-community',
    'numbered',
    'player',
  ],
  TB: ['film', 'standard', 'player', 'stats', 'numbered', 'game-result', 'player', 'game-result'],
  IND: [
    'business-community',
    'roster-roundup',
    'business-community',
    'transaction',
    'business-community',
    'recap',
    'coaching',
    'player',
  ],
};
for (const story of live)
  test('live sourced fields: ' + story.headline, () => {
    const d = adaptBeatStory(story);
    const index = live
      .filter((s) => s.teamAbbr === story.teamAbbr)
      .findIndex((s) => s.id === story.id);
    assert.equal(
      d.graphic.family.replace(/standard-.*/, 'standard'),
      liveExpected[story.teamAbbr][index],
    );
    assert(validBeatGraphic(d.graphic), JSON.stringify(d.graphic));
    for (const field of d.evidence) {
      if (field.source === 'canonical') assert.equal(field.excerpt, story.teamAbbr);
      else if (field.source !== 'structured') assert(story[field.source].includes(field.excerpt));
    }
    assert.deepEqual(
      d.sourceUrls,
      story.sources.map((s) => s.url),
    );
    assert.equal(d.asOf, story.updatedAt);
  });
const story = (headline: string, summary = '', category = 'ANALYSIS'): BeatStoryInput => ({
  id: headline,
  teamAbbr: 'BUF',
  headline,
  summary,
  category,
});
test('explicit facts and contextual exclusions', () => {
  assert.deepEqual(adaptBeatStory(story('Bills 41, Lions 31 | Final Score')).graphic, {
    family: 'game-result',
    leftTeam: 'BUF',
    rightTeam: 'DET',
    leftScore: 41,
    rightScore: 31,
    final: 'FINAL',
  });
  assert.deepEqual(adaptBeatStory(story('Top 3 things we learned | Week 2')).graphic, {
    family: 'numbered',
    count: '3',
    descriptor: 'THINGS\nLEARNED',
  });
  const injury = adaptBeatStory(story('Week 3 injury report', 'Three players DNP')).graphic;
  assert.equal(injury.family, 'injury');
  assert(!JSON.stringify(injury).includes('OUT'));
  assert(!JSON.stringify(injury).includes('"count"'));
  const current = adaptBeatStory(
    story('Injury update on WR DJ Moore', 'questionable to return', 'INJURY'),
  ).graphic;
  assert.equal(current.family, 'player');
  if (current.family === 'player') assert.equal(current.context, 'IN-GAME UPDATE');
  assert.equal(
    adaptBeatStory(story('Girls Flag Football Player of the Week', '', 'DRAFT')).displayCategory,
    'Community',
  );
  assert.equal(
    adaptBeatStory(story('Inside the Numbers: Dolphins youth flashes')).graphic.family,
    'stats',
  );
  assert.equal(
    adaptBeatStory(story('Bills elevate WR Greg Dortch and RB Frank Gore Jr.')).graphic.family,
    'transaction',
  );
  assert.equal(
    adaptBeatStory(story('NFL Power Rankings Week 3')).graphic.family.startsWith('standard'),
    true,
  );
  const transcript = adaptBeatStory(story('Transcript: HC Jeff Hafley Press Conference')).graphic;
  assert(transcript.family.startsWith('standard'));
  assert(!('quote' in transcript));
  assert(!('mediaUrl' in transcript));
});
test('structured fields take precedence over text', () => {
  const d = adaptBeatStory({
    ...story('Game Preview Bills vs. Lions'),
    graphic: { family: 'numbered', count: '5', descriptor: 'TAKEAWAYS' },
  });
  assert.equal(d.graphic.family, 'numbered');
  assert(d.evidence.every((e) => e.source === 'structured'));
});
