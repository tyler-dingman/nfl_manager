import test from 'node:test';
import assert from 'node:assert/strict';
import { isTradeDeadlinePassed } from './front-office-trade-window';

test('trading closes at Week 10 and stays closed through every playoff round', () => {
  for (let week = 1; week <= 18; week++) {
    assert.equal(isTradeDeadlinePassed(`week-${week}`, week), week >= 10);
  }
  for (const phase of ['wild-card', 'divisional', 'conference', 'super-bowl', 'playoffs']) {
    assert.equal(isTradeDeadlinePassed(phase, 1), true);
  }
});

test('offseason trading reopens even while currentWeek retains the completed season', () => {
  for (const phase of [
    'offseason',
    'resign_cut',
    'scouting_combine',
    'free_agency',
    'free_agency_open',
    'draft',
    'post-draft',
    'preseason',
    'week-1',
  ]) {
    assert.equal(isTradeDeadlinePassed(phase, 23), false, phase);
  }
});

test('legacy season clocks use week, but explicit phase takes precedence', () => {
  assert.equal(isTradeDeadlinePassed('season', 9), false);
  assert.equal(isTradeDeadlinePassed('season', 10), true);
  assert.equal(isTradeDeadlinePassed(undefined, 18), true);
  assert.equal(isTradeDeadlinePassed('week-9', 10), false);
  assert.equal(isTradeDeadlinePassed('week-10', 9), true);
});
