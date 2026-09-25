import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TEAM_HERO_COPY, getTeamHeroCopy, getTeamHeroDescription } from '@/config/team-hero-copy';
import { TEAM_LIST } from '@/data/teams';

const hero = readFileSync(
  new URL('../../components/home/game-day-homepage-hero.tsx', import.meta.url),
  'utf8',
);
const homepage = readFileSync(
  new URL('../../components/down-distance-home.tsx', import.meta.url),
  'utf8',
);

test('one homepage hero renders standard and gameday content states', () => {
  assert.match(hero, /const isGameDay = Boolean\(game\)/);
  assert.match(hero, /HomeTeamHeadline teamAbbr=\{team.abbr\}/);
  assert.match(hero, /GAMEDAY\./);
  assert.match(homepage, /game={homepageGame}/);
});

test('standard copy and dynamic team metadata are preserved', () => {
  assert.match(hero, /\{team\.name\}/);
  assert.doesNotMatch(hero, /OPEN FRONT OFFICE|YOUR ALL-IN-ONE/);
  assert.match(hero, /getTeamHeroDescription\(team.abbr\)/);
  assert.doesNotMatch(hero, /Kansas City|Chiefs/);
});

test('both states share the configured image, dimensions, crop, and headline typography', () => {
  assert.match(hero, /gameDayHeroAsset\(team\.abbr\)/);
  assert.equal((hero.match(/min-h-\[430px\]/g) ?? []).length, 2);
  assert.match(hero, /object-\[58%_center\]/);
  assert.equal((hero.match(/text-\[clamp\(2\.8rem,7vw,5\.5rem\)\]/g) ?? []).length, 1);
});

test('every canonical team has fan copy and unknown teams receive a neutral fallback', () => {
  assert.deepEqual(Object.keys(TEAM_HERO_COPY).sort(), TEAM_LIST.map((t) => t.abbr).sort());
  assert.deepEqual(getTeamHeroCopy('CAR'), { line1: 'Keep', line2: 'Pounding.' });
  assert.deepEqual(getTeamHeroCopy('KC'), { line1: 'Home of the', line2: 'Chiefs.' });
  assert.deepEqual(getTeamHeroCopy('PHI'), { line1: 'Fly, Eagles,', line2: 'Fly!' });
  assert.deepEqual(getTeamHeroCopy('DET'), { line1: 'One', line2: 'Pride.' });
  for (const team of [null, undefined, 'UNKNOWN'])
    assert.deepEqual(getTeamHeroCopy(team), { line1: 'Your team.', line2: 'Every day.' });
});

test('hero description uses canonical team markets', () => {
  for (const team of TEAM_LIST) {
    assert.equal(
      getTeamHeroDescription(team.abbr),
      `Your home for everything ${team.city} football — the latest news, analysis, roster moves, and fan conversation. Run the team, test your knowledge, and research your next parlay.`,
    );
  }
  assert.ok(getTeamHeroDescription(null).startsWith('Your home for everything football —'));
});
