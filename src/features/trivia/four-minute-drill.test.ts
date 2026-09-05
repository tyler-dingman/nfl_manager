import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DRILL_GAME_CLOCK_SECONDS,
  DRILL_PLAY_CLOCK_SECONDS,
  DRILL_QUESTION_COUNT,
  DRILL_YARDS_PER_CORRECT_ANSWER,
  formatDrillClock,
  getDrillGameSecondsRemaining,
  rankDrillStandings,
} from './four-minute-drill';

test('uses the approved four minute drill rules', () => {
  assert.equal(DRILL_QUESTION_COUNT, 10);
  assert.equal(DRILL_PLAY_CLOCK_SECONDS, 24);
  assert.equal(DRILL_GAME_CLOCK_SECONDS, 240);
  assert.equal(DRILL_YARDS_PER_CORRECT_ANSWER, 10);
});

test('game clock counts question-open time and formats as a clock', () => {
  assert.equal(getDrillGameSecondsRemaining(30_500, 5_500), 204);
  assert.equal(formatDrillClock(204), '3:24');
  assert.equal(getDrillGameSecondsRemaining(240_000), 0);
});

test('a full first play rolls the game clock from 4:00 to 3:36', () => {
  const remaining = getDrillGameSecondsRemaining(0, 24_000);
  assert.equal(remaining, 216);
  assert.equal(formatDrillClock(remaining), '3:36');
});

test('standings break ties by correct answers then response time', () => {
  const ranked = rankDrillStandings([
    { userId: 'slow', score: 50, correctAnswers: 5, responseTimeTotalMs: 20_000 },
    { userId: 'yards', score: 60, correctAnswers: 4, responseTimeTotalMs: 30_000 },
    { userId: 'fast', score: 50, correctAnswers: 5, responseTimeTotalMs: 10_000 },
  ]);
  assert.deepEqual(
    ranked.map((row) => row.userId),
    ['yards', 'fast', 'slow'],
  );
});
