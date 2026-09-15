import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesTrendingMarketFilter } from './trending-market-filter';

test('matches the main trending prop categories regardless of stored casing', () => {
  assert.equal(matchesTrendingMarketFilter({ marketType: 'passing_yards' }, 'PASSING'), true);
  assert.equal(matchesTrendingMarketFilter({ marketType: 'RUSHING_ATTEMPTS' }, 'RUSHING'), true);
  assert.equal(matchesTrendingMarketFilter({ marketType: 'Receiving Yards' }, 'RECEIVING'), true);
  assert.equal(matchesTrendingMarketFilter({ marketType: 'RECEPTIONS' }, 'RECEIVING'), true);
});

test('recognizes touchdown aliases and allows passing touchdowns in both useful tabs', () => {
  const passingTouchdowns = { marketType: 'PASSING_TD', statId: 'passing_touchdowns' };
  assert.equal(matchesTrendingMarketFilter(passingTouchdowns, 'PASSING'), true);
  assert.equal(matchesTrendingMarketFilter(passingTouchdowns, 'TOUCHDOWN'), true);
  assert.equal(matchesTrendingMarketFilter({ marketType: 'ANYTIME_TOUCHDOWN' }, 'TOUCHDOWN'), true);
});

test('all matches every market and unrelated categories do not match', () => {
  const market = { marketType: 'FIELD_GOALS' };
  assert.equal(matchesTrendingMarketFilter(market, 'ALL'), true);
  assert.equal(matchesTrendingMarketFilter(market, 'PASSING'), false);
});

test('places combined passing and rushing yards in Passing only', () => {
  const market = {
    marketType: 'PASSING_RUSHING_YARDS',
    statId: 'passing+rushing_yards',
  };
  assert.equal(matchesTrendingMarketFilter(market, 'PASSING'), true);
  assert.equal(matchesTrendingMarketFilter(market, 'RUSHING'), false);
});
