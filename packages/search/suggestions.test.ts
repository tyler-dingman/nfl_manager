import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_QUICK_PROMPTS, contextualSearchQuestions } from './suggestions';
const empty = {
  teamName: 'Bills',
  nextGame: false,
  previousGame: false,
  injuries: false,
  recentNews: false,
  todayNews: false,
};
test('hide suggestions without usable team data', () => {
  assert.deepEqual(contextualSearchQuestions(empty), []);
  assert.deepEqual(contextualSearchQuestions({ ...empty, teamName: '', nextGame: true }), []);
});
test('questions reflect team and available evidence only', () => {
  assert.deepEqual(contextualSearchQuestions({ ...empty, nextGame: true, injuries: true }), [
    'When do the Bills play next?',
    "What's the latest on Bills injuries?",
  ]);
  assert.deepEqual(contextualSearchQuestions({ ...empty, teamName: 'Ravens', recentNews: true }), [
    "What's the latest Ravens news?",
  ]);
  assert.equal(AI_QUICK_PROMPTS.length, 3);
});
