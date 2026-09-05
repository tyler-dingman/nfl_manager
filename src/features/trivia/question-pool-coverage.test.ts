import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM_LIST } from '@/data/teams';
import { TRIVIA_QUESTION_BANK } from './question-bank';

test('every NFL team has ten bundled active questions for a fresh database', () => {
  for (const team of TEAM_LIST) {
    const questions = TRIVIA_QUESTION_BANK.filter(
      (question) => question.teamId === team.abbr && question.active && question.correctAnswer,
    );
    assert.equal(questions.length >= 10, true, `${team.abbr} has fewer than ten questions`);
    assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  }
});
