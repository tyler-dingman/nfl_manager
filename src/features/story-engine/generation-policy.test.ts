import assert from 'node:assert/strict';
import test from 'node:test';
import { maxNewAiStoriesPerTeamPerDay, mayGenerateNewStory } from './generation-policy';

test('daily local-AI cap defaults to ten per team', () =>
  assert.equal(maxNewAiStoriesPerTeamPerDay({}), 10));
test('new local-AI stories stop at ten', () => {
  assert.equal(mayGenerateNewStory({ provider: 'ollama', publishedToday: 9, maximum: 10 }), true);
  assert.equal(mayGenerateNewStory({ provider: 'ollama', publishedToday: 10, maximum: 10 }), false);
});
test('existing canonical story updates remain allowed after the new-story cap', () =>
  assert.equal(
    mayGenerateNewStory({
      provider: 'ollama',
      publishedToday: 10,
      maximum: 10,
      existingStory: true,
    }),
    true,
  ));
test('invalid caps fail closed', () =>
  assert.throws(
    () => maxNewAiStoriesPerTeamPerDay({ MAX_NEW_AI_STORIES_PER_TEAM_PER_DAY: '0' }),
    /positive integer/,
  ));
