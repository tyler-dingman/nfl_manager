import assert from 'node:assert/strict';
import test from 'node:test';
import { REWARD_ACTION_YARDS, REWARD_DEFINITIONS } from './config';

test('Yard actions are centralized and distinct from Trivia Points', () => {
  assert.equal(REWARD_ACTION_YARDS.TRIVIA_CORRECT, 1);
  assert.equal(REWARD_ACTION_YARDS.TRIVIA_GAME_COMPLETE, 2);
  assert.equal(REWARD_ACTION_YARDS.TRIVIA_BUDDY_WIN, 3);
});

test('reward ladder is ordered and ends with a one-use 40 percent reward', () => {
  assert.deepEqual(
    REWARD_DEFINITIONS.map((reward) => reward.thresholdYards),
    [50, 100, 250, 500, 1000, 2500, 5000, 10000],
  );
  const premium = REWARD_DEFINITIONS.at(-1);
  assert.equal(premium?.discountPercent, 40);
  assert.equal(premium?.usageLimit, 1);
});
