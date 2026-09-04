import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { KOOZIE_PRODUCTS, MERCH_PRODUCTS } from './catalog';

test('catalog includes one Accessories koozie for every NFL team image', () => {
  assert.equal(KOOZIE_PRODUCTS.length, 32);
  assert.equal(new Set(KOOZIE_PRODUCTS.map(({ id }) => id)).size, 32);
  for (const product of KOOZIE_PRODUCTS) {
    assert.equal(product.category, 'Accessories');
    assert.equal(product.type, 'Koozie');
    assert.equal(product.sizes[0], 'One Size');
    assert.ok(product.imageUrl);
    assert.ok(
      existsSync(`public${product.imageUrl}`),
      `Missing product image: ${product.imageUrl}`,
    );
    assert.ok(MERCH_PRODUCTS.some(({ id }) => id === product.id));
  }
});

test('koozie titles use D&D city colorway names without team nicknames', () => {
  const forbidden = [
    'Chiefs',
    'Ravens',
    'Cardinals',
    'Falcons',
    'Bills',
    'Panthers',
    'Bears',
    'Bengals',
    'Browns',
    'Cowboys',
    'Broncos',
    'Lions',
    'Packers',
    'Texans',
    'Colts',
    'Jaguars',
    'Raiders',
    'Chargers',
    'Rams',
    'Dolphins',
    'Vikings',
    'Patriots',
    'Saints',
    'Giants',
    'Jets',
    'Eagles',
    'Steelers',
    '49ers',
    'Seahawks',
    'Buccaneers',
    'Titans',
    'Commanders',
  ];
  assert.equal(
    KOOZIE_PRODUCTS.find(({ id }) => id === 'kansas-city-chiefs-koozie')?.name,
    'D&D Koozie — Kansas City Colorway',
  );
  for (const product of KOOZIE_PRODUCTS) {
    assert.match(product.name, /^D&D Koozie — .+ Colorway$/);
    assert.equal(
      forbidden.some((nickname) => product.name.includes(nickname)),
      false,
      product.name,
    );
  }
});
