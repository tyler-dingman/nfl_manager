import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readMarketNavigation,
  writeMarketNavigation,
  availableMarketFacets,
} from './market-navigation';
import type { HomeMarket } from './research';
test('root defaults to all and URL casing is normalized', () => {
  assert.deepEqual(readMarketNavigation(new URLSearchParams()), { category: 'ALL', market: 'ALL' });
  assert.deepEqual(
    readMarketNavigation(new URLSearchParams('category=passing&market=passing_yards')),
    { category: 'PASSING', market: 'PASSING_YARDS' },
  );
  assert.deepEqual(
    readMarketNavigation(new URLSearchParams('category=receiving&market=PASSING_YARDS')),
    { category: 'RECEIVING', market: 'ALL' },
  );
  assert.deepEqual(readMarketNavigation(new URLSearchParams('market=passing_yards')), {
    category: 'ALL',
    market: 'ALL',
  });
  assert.deepEqual(readMarketNavigation(new URLSearchParams('category=bad&market=bad')), {
    category: 'ALL',
    market: 'ALL',
  });
});
test('actual available facets validate secondary markets without inventing markets', () => {
  const facets = availableMarketFacets([{ marketType: 'RECEPTIONS' } as HomeMarket]);
  assert.deepEqual(
    readMarketNavigation(new URLSearchParams('category=receiving&market=receiving_yards'), facets),
    { category: 'RECEIVING', market: 'ALL' },
  );
  assert.deepEqual(
    readMarketNavigation(new URLSearchParams('category=receiving&market=receptions'), facets),
    { category: 'RECEIVING', market: 'RECEPTIONS' },
  );
});
test('category transitions and back preserve unrelated query parameters', () => {
  const start = new URLSearchParams(
    'team=KC&book=DRAFTKINGS&sort=score&category=passing&market=passing_yards',
  );
  const receiving = writeMarketNavigation(start, 'RECEIVING');
  assert.equal(receiving.get('category'), 'receiving');
  assert.equal(receiving.has('market'), false);
  const specific = writeMarketNavigation(receiving, 'RECEIVING', 'RECEPTIONS');
  assert.equal(specific.get('market'), 'receptions');
  const root = writeMarketNavigation(specific, 'ALL');
  assert.equal(root.has('category'), false);
  assert.equal(root.has('market'), false);
  assert.equal(root.get('team'), 'KC');
  assert.equal(root.get('book'), 'DRAFTKINGS');
  assert.equal(root.get('sort'), 'score');
  assert.equal(start.get('category'), 'passing');
});
