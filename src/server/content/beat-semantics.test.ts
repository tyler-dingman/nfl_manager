import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichBeatTransaction } from './beat-transactions';
import { adaptBeatStory, type BeatStoryInput } from '@/components/beat/beat-story-adapter';
import { beatGameMetadata, type CanonicalGame } from '@/lib/canonical-game';
import { resolveStoryGame } from '@/server/schedule/resolve';
const story = (headline: string, summary = '', teamAbbr = 'KC'): BeatStoryInput => ({
  id: headline,
  category: 'ANALYSIS',
  teamAbbr,
  headline,
  summary,
  updatedAt: '2026-09-18T14:01:00Z',
});
const game: CanonicalGame = {
  id: 'fixture-game',
  season: 2026,
  seasonType: 'REG',
  week: 2,
  homeTeam: 'KC',
  awayTeam: 'IND',
  kickoffAt: '2026-09-21T00:20:00Z',
  kickoffConfirmed: true,
  status: 'FINAL',
  homeScore: 33,
  awayScore: 30,
  overtime: true,
  venue: null,
  broadcastNetwork: null,
};
test('Chiefs fan information identifies the canonical game and retains pregame intent after final', () => {
  const s = story(
    "Important Fan Information for Sunday Night's Game vs. Indianapolis at Arrowhead Stadium",
  );
  assert.equal(resolveStoryGame(s, [game]).gameId, game.id);
  const d = adaptBeatStory({ ...s, game: beatGameMetadata(game, 'KC') });
  assert.equal(d.displayCategory, 'Game Info');
  assert.deepEqual(d.graphic, {
    family: 'game-matchup',
    leftTeam: 'IND',
    rightTeam: 'KC',
    week: 'WEEK 2',
    kickoff: 'SUN · 8:20 PM ET',
  });
});
test('stadium tours are events; unrelated uses of tour are not events', () => {
  const d = adaptBeatStory(
    story('Kenny Chesney Returns to Stadiums with the All-stadium Original Vibe Tour 2027'),
  );
  assert.deepEqual(d.graphic, { family: 'off_field', subtype: 'EVENT', label: 'STADIUM\nEVENTS' });
  assert.notEqual(
    adaptBeatStory(story('Chiefs rookies tour the practice facility')).graphic.family,
    'off_field',
  );
});
test('Benson profile resolves LT from the article and never invents a number', () => {
  const s = story(
    'Kahlil Benson is one step away from completing his stunning Chiefs rise',
    'Kahlil Benson is expected to start at left tackle for the Chiefs in Week 1 with Josh Simmons unlikely to play.',
  );
  const d = enrichBeatTransaction(s);
  assert.equal(d.displayCategory, 'Player focus');
  assert.equal(d.graphic.family, 'player');
  if (d.graphic.family === 'player') {
    assert.equal(d.graphic.name, 'Kahlil Benson');
    assert.equal(d.graphic.position, 'LT');
    assert.equal(d.graphic.jersey, undefined);
    assert.equal(d.graphic.status, undefined);
  }
  assert.equal(s.category, 'ANALYSIS');
  const update = enrichBeatTransaction(
    story('Kahlil Benson expected to start Sunday after being limited'),
  );
  assert.equal(update.displayCategory, 'Player update');
});
test('specific editorial formats override Analysis without game metadata overriding lists', () => {
  const examples: [string, string][] = [
    ['10 Quick Facts Following the Chiefs Week 2 Win', 'numbered'],
    ['5 Notes from Sunday', 'numbered'],
    ['5 Things to Know About NFL Power Rankings', 'numbered'],
    ['3x3', 'numbered'],
    ['Inside the Numbers', 'stats'],
    ['Statistical trends in the run game', 'stats'],
    ['Know Your Foe: Colts', 'scouting'],
    ['Breaking Down the Colts', 'scouting'],
    ['Chiefs coaching philosophy shapes their game plan', 'coaching'],
    ['Chiefs film breakdown of the winning drive', 'film'],
    ['Questions From Fans: This week', 'mailbag'],
    ['Hands of 10ve Foundation announces $45,000 donation', 'business-community'],
    ['Rams and Edwards Lifesciences extend partnership', 'off_field'],
    ['Packers, Chiefs collaborate for pop-up retail store', 'off_field'],
  ];
  for (const [h, f] of examples)
    assert.equal(
      adaptBeatStory({ ...story(h), game: beatGameMetadata(game, 'KC') }).graphic.family,
      f,
      h,
    );
});
test('actual interpretation remains Analysis; ambiguous news is Editorial', () => {
  for (const h of [
    'Why the Chiefs offense is struggling in the red zone',
    "What Sunday's performance tells us about the secondary",
    'Chiefs 2-0 formula and whether it is sustainable',
    'Breaking down the biggest questions facing Kansas City',
    'Why the run game has improved',
    'What the first two weeks tell us about the Chiefs',
  ])
    assert.equal(adaptBeatStory(story(h)).graphic.family, 'analysis', h);
  assert.equal(
    adaptBeatStory(story('Chiefs publish team announcement')).displayCategory,
    'Editorial',
  );
});
test('player features generalize across teams with unknown fields omitted', () => {
  for (const [h, t] of [
    ['How DeeJay Dallas Quickly Earned Vikings Trust', 'MIN'],
    ['How Dewey Wingard Became A Hit For Cardinals', 'ARI'],
    ['David Walker Takes Advantage of Opportunity Against Browns', 'TB'],
  ])
    assert.equal(enrichBeatTransaction(story(h, '', t)).displayCategory, 'Player focus', h);
  assert.notEqual(
    enrichBeatTransaction(
      story('Why the secondary is struggling', 'Kahlil Benson also spoke to reporters.'),
    ).graphic.family,
    'player',
  );
});
