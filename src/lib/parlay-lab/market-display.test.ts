import test from 'node:test';
import assert from 'node:assert/strict';
import { marketDisplayName, marketStatExplanation } from './market-display';

test('passing and personally scored touchdown markets have distinct research labels', () => {
  assert.equal(marketDisplayName('PASSING_TD'), 'Passing TDs');
  assert.equal(marketDisplayName('PASSING_TDS'), 'Passing TDs');
  assert.equal(marketDisplayName('TOUCHDOWNS'), 'Touchdowns Scored');
  assert.equal(marketDisplayName('ANYTIME_TD'), 'Touchdowns Scored');
  assert.match(marketStatExplanation('TOUCHDOWNS')!, /Passing touchdowns do not count/);
  assert.match(marketStatExplanation('PASSING_TD')!, /passes thrown/);
  assert.equal(marketStatExplanation('PASSING_YARDS'), null);
});
