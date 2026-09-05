import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DRILL_GAME_CLOCK_SECONDS,
  DRILL_PLAY_CLOCK_SECONDS,
  DRILL_QUESTION_COUNT,
  DRILL_YARDS_PER_CORRECT_ANSWER,
  formatDrillClock,
  getDrillYards,
  getDrillGameSeconds,
  getQuestionStartSeconds,
  rankDrillStandings,
} from './four-minute-drill';

test('uses the approved four minute drill rules', () => {
  assert.equal(DRILL_QUESTION_COUNT, 10);
  assert.equal(DRILL_PLAY_CLOCK_SECONDS, 24);
  assert.equal(DRILL_GAME_CLOCK_SECONDS, 240);
  assert.equal(DRILL_YARDS_PER_CORRECT_ANSWER, 10);
});

test('correct answers move ten yards and incorrect answers produce no gain', () => {
  assert.equal(getDrillYards(true), 10);
  assert.equal(getDrillYards(false), 0);
});

test('each question starts on its fixed 24-second boundary', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => getQuestionStartSeconds(index + 1)),
    [240, 216, 192, 168, 144, 120, 96, 72, 48, 24],
  );
});

test('game and play clocks stay coordinated without cumulative drift', () => {
  assert.equal(formatDrillClock(getDrillGameSeconds(1, 24)), '4:00');
  assert.equal(formatDrillClock(getDrillGameSeconds(2, 24)), '3:36');
  assert.equal(formatDrillClock(getDrillGameSeconds(2, 14)), '3:26');
  assert.equal(formatDrillClock(getDrillGameSeconds(2, 0)), '3:12');
  assert.equal(formatDrillClock(getDrillGameSeconds(10, 24)), '0:24');
  assert.equal(formatDrillClock(getDrillGameSeconds(10, 0)), '0:00');
});

test('an early answer fast-forwards to the exact next boundary', () => {
  assert.equal(getDrillGameSeconds(1, 15), 231);
  assert.equal(getDrillGameSeconds(1, 15, true), 216);
  assert.equal(formatDrillClock(getDrillGameSeconds(1, 15, true)), '3:36');
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
