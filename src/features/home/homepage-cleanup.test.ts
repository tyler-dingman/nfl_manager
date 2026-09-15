import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const homepage = readFileSync(
  new URL('../../components/down-distance-home.tsx', import.meta.url),
  'utf8',
);
const deliveryPreferences = readFileSync(
  new URL('../../components/three-and-out/three-out-delivery-preferences.tsx', import.meta.url),
  'utf8',
);
const filmRoom = readFileSync(
  new URL('../../components/film-room/film-room-grid.tsx', import.meta.url),
  'utf8',
);
const mobileMenu = readFileSync(
  new URL('../../components/mobile-site-menu.tsx', import.meta.url),
  'utf8',
);
const footer = readFileSync(new URL('../../components/site-footer.tsx', import.meta.url), 'utf8');
const gameDayConfig = readFileSync(
  new URL('../../config/game-day-hero.ts', import.meta.url),
  'utf8',
);

test('homepage Three and Out uses daily delivery preferences instead of audio', () => {
  assert.match(homepage, /<ThreeOutDeliveryPreferences \/>/);
  assert.doesNotMatch(homepage, /Play Three/);
  assert.match(deliveryPreferences, /Subscribe to Three & Out/);
  assert.match(deliveryPreferences, /Push Notifications/);
});

test('homepage Three and Out stays in the desktop right rail', () => {
  assert.match(homepage, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(homepage, /<aside className="space-y-6 lg:sticky/);
});

test('Three and Out ampersands use the accessible bright team accent on dark panels', () => {
  assert.match(homepage, /<span className="dd-three-out-ampersand">&amp;<\/span>/);
  assert.match(
    readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8'),
    /\.dd-three-out-ampersand\s*\{\s*color:\s*var\(--team-secondary-on-dark\);\s*\}/,
  );
});

test('homepage uses the current Film Room feed and no longer renders its trivia widget', () => {
  assert.match(homepage, /fetch\(`\/api\/film-room\?team=/);
  assert.match(homepage, /latestFilmRoomVideos/);
  assert.match(homepage, /<FilmRoomCard/);
  assert.match(homepage, /<FilmRoomVideoModal/);
  assert.doesNotMatch(homepage, /DailyTriviaWidget/);
  assert.match(filmRoom, /export function FilmRoomCard/);
});

test('search results use canonical content and watch routes and Enter opens the first match', () => {
  assert.match(homepage, /href: `\/content\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(homepage, /href: `\/watch\?team=/);
  assert.match(homepage, /event\.key === 'Enter' && searchResults\[0\]/);
  assert.match(homepage, /router\.push\(searchResults\[0\]\.href\)/);
});

test('mobile menu removes the logged-out spacer and shared footer reserves bottom-nav space', () => {
  assert.match(mobileMenu, /className={user \? 'mt-auto' : ''}/);
  assert.match(footer, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.doesNotMatch(footer, /Keep it high and tight/);
});

test('all 32 team homepages map to an existing gameday stadium image', () => {
  const teams = [
    'ARI',
    'ATL',
    'BAL',
    'BUF',
    'CAR',
    'CHI',
    'CIN',
    'CLE',
    'DAL',
    'DEN',
    'DET',
    'GB',
    'HOU',
    'IND',
    'JAX',
    'KC',
    'LAC',
    'LAR',
    'LV',
    'MIA',
    'MIN',
    'NE',
    'NO',
    'NYG',
    'NYJ',
    'PHI',
    'PIT',
    'SEA',
    'SF',
    'TB',
    'TEN',
    'WAS',
  ];

  for (const team of teams) {
    const match = gameDayConfig.match(new RegExp(`${team}: '([^']+gameday\\.png)'`));
    assert.ok(match, `${team} is missing from GAME_DAY_HERO_ASSETS`);
    assert.ok(existsSync(`public${match[1]}`), `${team} hero asset does not exist: ${match[1]}`);
  }
});
