import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlayerTypeIndicator } from '@/lib/player-type-indicator';

test('classifies superstar first', () => {
  const indicator = getPlayerTypeIndicator({ age: 25, rating: 91 });
  assert.equal(indicator?.type, 'superstar');
});

test('classifies up and coming when young and strong but not superstar', () => {
  const indicator = getPlayerTypeIndicator({ age: 24, rating: 82 });
  assert.equal(indicator?.type, 'upcoming');
});

test('classifies declining when older and not superstar', () => {
  const indicator = getPlayerTypeIndicator({ age: 33, rating: 88 });
  assert.equal(indicator?.type, 'declining');
});

test('superstar takes precedence over up and coming and declining', () => {
  assert.equal(getPlayerTypeIndicator({ age: 25, rating: 91 })?.type, 'superstar');
  assert.equal(getPlayerTypeIndicator({ age: 33, rating: 90 })?.type, 'superstar');
});

test('returns null when rating is missing', () => {
  const indicator = getPlayerTypeIndicator({ age: 24 });
  assert.equal(indicator, null);
});

test('returns null for age-based buckets when age is missing', () => {
  const indicator = getPlayerTypeIndicator({ rating: 82 });
  assert.equal(indicator, null);
});
