import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
  assert.match(hero, /YOUR ALL-IN-ONE/);
  assert.match(hero, /GAMEDAY\./);
  assert.match(homepage, /game={homepageGame}/);
});

test('standard copy and dynamic team metadata are preserved', () => {
  assert.match(hero, /\{team\.name\}/);
  assert.match(hero, /\{teamNickname\(team\)\} HUB\./);
  assert.match(
    hero,
    /The stories, videos, roster moves, and fan conversations that matter—ranked and\s+explained for you\./,
  );
  assert.doesNotMatch(hero, /Kansas City|Chiefs/);
});

test('both states share the configured image, dimensions, crop, and headline typography', () => {
  assert.match(hero, /gameDayHeroAsset\(team\.abbr\)/);
  assert.equal((hero.match(/min-h-\[430px\]/g) ?? []).length, 2);
  assert.match(hero, /object-\[58%_center\]/);
  assert.equal((hero.match(/text-\[clamp\(2\.8rem,7vw,5\.5rem\)\]/g) ?? []).length, 1);
});
