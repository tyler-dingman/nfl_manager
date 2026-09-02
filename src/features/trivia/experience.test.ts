import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTriviaRecap,
  canStartBuddyRoom,
  canSubmitTriviaAnswer,
  getLeaderboardMovement,
  nextTriviaPhase,
} from './experience';

test('an answer can only be submitted before it is locked', () => {
  assert.equal(canSubmitTriviaAnswer('QUESTION'), true);
  assert.equal(canSubmitTriviaAnswer('LOCKED'), false);
  assert.equal(canSubmitTriviaAnswer('REVEAL'), false);
});

test('game experience progresses through reveal and standings', () => {
  assert.equal(nextTriviaPhase('QUESTION'), 'LOCKED');
  assert.equal(nextTriviaPhase('LOCKED'), 'REVEAL');
  assert.equal(nextTriviaPhase('REVEAL'), 'STANDINGS');
  assert.equal(nextTriviaPhase('STANDINGS'), 'QUESTION');
  assert.equal(nextTriviaPhase('STANDINGS', true), 'COMPLETE');
});

test('leaderboard movement is positive when a player moves up', () => {
  assert.equal(getLeaderboardMovement(5, 3), 2);
  assert.equal(getLeaderboardMovement(2, 4), -2);
  assert.equal(getLeaderboardMovement(3, 3), 0);
});

test('buddy rooms require two players and cap participation at five', () => {
  assert.equal(canStartBuddyRoom(1), false);
  assert.equal(canStartBuddyRoom(2), true);
  assert.equal(canStartBuddyRoom(5), true);
  assert.equal(canStartBuddyRoom(6), false);
});

test('final recap deterministically selects winner and biggest loser', () => {
  const recap = buildTriviaRecap([
    { userId: 'b', name: 'Matt', score: 220, correctAnswers: 7 },
    { userId: 'a', name: 'Jordyn', score: 220, correctAnswers: 8 },
    { userId: 'c', name: 'Chris', score: 140, correctAnswers: 4 },
  ]);
  assert.equal(recap.winner?.name, 'Jordyn');
  assert.equal(recap.biggestLoser?.name, 'Chris');
  assert.deepEqual(
    recap.ranked.map((player) => player.name),
    ['Jordyn', 'Matt', 'Chris'],
  );
});
