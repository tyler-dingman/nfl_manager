import assert from 'node:assert/strict';
import test from 'node:test';

import {
  awardMoveTheChains,
  calculateTriviaPoints,
  scoreAnswer,
  selectDailyQuestion,
} from './engine';

test('trivia scoring awards 20 base points plus whole seconds remaining', () => {
  assert.equal(calculateTriviaPoints(true, 5_000), 35);
  assert.equal(calculateTriviaPoints(true, 15_000), 25);
  assert.equal(calculateTriviaPoints(true, 19_999), 20);
  assert.equal(calculateTriviaPoints(false, 0), 0);
  assert.equal(calculateTriviaPoints(true, 20_000), 0);
});

test('a timeout and a wrong answer always award zero points', () => {
  assert.equal(calculateTriviaPoints(true, 20_000), 0);
  assert.equal(calculateTriviaPoints(true, 25_000), 0);
  assert.equal(calculateTriviaPoints(false, 500), 0);
});

test('Move the Chains rolls over at touchdown', () => {
  assert.deepEqual(awardMoveTheChains(99, 0, 99, 1), {
    currentDriveYards: 0,
    touchdowns: 1,
    lifetimeYards: 100,
  });
  assert.deepEqual(awardMoveTheChains(99, 0, 99, 3), {
    currentDriveYards: 2,
    touchdowns: 1,
    lifetimeYards: 102,
  });
});

test('daily question selection is deterministic', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(
    selectDailyQuestion(questions, 'KC', '2026-08-30')?.id,
    selectDailyQuestion(questions, 'KC', '2026-08-30')?.id,
  );
  assert.notEqual(
    selectDailyQuestion(questions, 'KC', '2026-08-30')?.id,
    selectDailyQuestion(questions, 'KC', '2026-08-31')?.id,
  );
});

test('answer result distinguishes correct selection from a wrong selection', () => {
  assert.deepEqual(scoreAnswer('B', 'B', 1_000), { correct: true, points: 39 });
  assert.deepEqual(scoreAnswer('B', 'A', 1_000), { correct: false, points: 0 });
});
