import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTriviaStats } from './stats';

test('PostgreSQL decimal accuracy and string counts are safe to format', () => {
  const stats = normalizeTriviaStats({
    accuracy: '66.7',
    questionsAnswered: '3',
    correctAnswers: '2',
    lifetimePoints: '1200',
    weeklyPoints: '75',
    gamesPlayed: '1',
    currentStreak: '2',
    bestStreak: '2',
  });
  assert.equal(stats.accuracy.toFixed(1), '66.7');
  assert.equal(stats.lifetimePoints, 1200);
  assert.equal(stats.questionsAnswered, 3);
  assert.ok(Object.values(stats).every((value) => typeof value === 'number'));
  assert.deepEqual(normalizeTriviaStats(stats), stats);
});

test('missing and malformed stats never produce NaN or throw during rendering', () => {
  for (const value of [
    undefined,
    null,
    {},
    { accuracy: null },
    { accuracy: 'bad', questionsAnswered: '0' },
    { accuracy: Infinity },
    { accuracy: {} },
  ]) {
    const stats = normalizeTriviaStats(value);
    assert.equal(stats.accuracy.toFixed(1), '0.0');
    assert.equal(stats.questionsAnswered, 0);
    assert.ok(Object.values(stats).every(Number.isFinite));
  }
  assert.equal(normalizeTriviaStats({ accuracy: 110 }).accuracy, 100);
  assert.equal(normalizeTriviaStats({ accuracy: -1 }).accuracy, 0);
});
