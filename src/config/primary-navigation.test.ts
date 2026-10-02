import assert from 'node:assert/strict';
import test from 'node:test';

import { getPrimaryNavActive, getPrimaryNavHref, PRIMARY_NAV_ITEMS } from './primary-navigation';

test('primary navigation has the approved labels and destinations in order', () => {
  assert.deepEqual(
    PRIMARY_NAV_ITEMS.map(({ label, href }) => ({ label, href })),
    [
      { label: 'The Beat', href: '/the-beat' },
      { label: 'Film Room', href: '/watch' },
      { label: 'Front Office', href: '/offseasonmanager' },
      { label: 'Trivia', href: '/trivia' },
      { label: 'Parlay Lab', href: '/parlay-lab' },
      { label: 'The Huddle', href: '/huddle' },
      { label: 'Merch', href: '/merch' },
    ],
  );
});

test('nested product routes and Front Office routes retain their active item', () => {
  assert.equal(getPrimaryNavActive('/huddle/story/example'), 'huddle');
  assert.equal(getPrimaryNavActive('/the-beat'), 'huddle');
  assert.equal(getPrimaryNavActive('/huddle'), 'community');
  assert.equal(getPrimaryNavActive('/three-and-out/example'), null);
  assert.equal(getPrimaryNavActive('/offseasonmanager/draft'), 'front-office');
  assert.equal(getPrimaryNavActive('/draft/room'), 'front-office');
  assert.equal(getPrimaryNavActive('/parlay-lab'), 'parlay-lab');
  assert.equal(getPrimaryNavActive('/merch/camo-hat'), 'merch');
  assert.equal(getPrimaryNavActive('/game-day'), null);
  assert.equal(getPrimaryNavActive('/wire'), null);
});

test('team selection is retained without changing the canonical Merch destination', () => {
  assert.equal(getPrimaryNavHref('/the-beat', 'KC'), '/the-beat?team=KC');
  assert.equal(getPrimaryNavHref('/offseasonmanager', 'KC'), '/offseasonmanager?team=KC');
  assert.equal(getPrimaryNavHref('/merch', 'KC'), '/merch');
});

test('primary section aliases and descendants resolve without matching unrelated prefixes', () => {
  for (const [path, id] of [
    ['/beat/story', 'huddle'],
    ['/film-room/video', 'watch'],
    ['/front-office/roster', 'front-office'],
    ['/front-office/draft/prospect', 'front-office'],
    ['/trivia/game', 'trivia'],
    ['/parlay-lab/players', 'parlay-lab'],
    ['/parlay-lab/alt-stack', 'parlay-lab'],
    ['/merch/product', 'merch'],
  ] as const)
    assert.equal(getPrimaryNavActive(path), id);
  for (const path of ['/beatbox', '/film-roommates', '/merchandise', '/account', '/'])
    assert.equal(getPrimaryNavActive(path), null);
});
