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
      { label: 'Merch', href: '/merch' },
    ],
  );
});

test('nested product routes and Front Office routes retain their active item', () => {
  assert.equal(getPrimaryNavActive('/huddle/story/example'), 'huddle');
  assert.equal(getPrimaryNavActive('/the-beat'), 'huddle');
  assert.equal(getPrimaryNavActive('/three-and-out/example'), null);
  assert.equal(getPrimaryNavActive('/offseasonmanager/draft'), 'front-office');
  assert.equal(getPrimaryNavActive('/draft/room'), 'front-office');
  assert.equal(getPrimaryNavActive('/merch/camo-hat'), 'merch');
  assert.equal(getPrimaryNavActive('/game-day'), null);
  assert.equal(getPrimaryNavActive('/wire'), null);
});

test('team selection is retained without changing the canonical Merch destination', () => {
  assert.equal(getPrimaryNavHref('/the-beat', 'KC'), '/the-beat?team=KC');
  assert.equal(getPrimaryNavHref('/offseasonmanager', 'KC'), '/offseasonmanager?team=KC');
  assert.equal(getPrimaryNavHref('/merch', 'KC'), '/merch');
});
