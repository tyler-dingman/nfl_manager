import assert from 'node:assert/strict';
import test from 'node:test';
import { getEditorialVisualForStory } from './index';

test('uses explicit visual override first', () => {
  assert.equal(
    getEditorialVisualForStory({
      teamId: 'KC',
      headline: 'Player signed',
      visualTypeOverride: 'QUOTE',
    }).visualType,
    'QUOTE',
  );
});

test('classifies structured football stories deterministically', () => {
  assert.equal(
    getEditorialVisualForStory({ teamId: 'IND', storyType: 'INJURY', headline: 'Practice update' })
      .visualType,
    'INJURY_AVAILABILITY',
  );
  assert.equal(
    getEditorialVisualForStory({
      teamId: 'GB',
      storyType: 'TRADE',
      headline: 'Club acquires tackle',
    }).visualType,
    'TRADE',
  );
});

test('falls back to a team-aware headline visual', () => {
  const visual = getEditorialVisualForStory({ teamId: 'MIA', headline: 'A new development' });
  assert.equal(visual.visualType, 'GENERIC_NEWS');
  assert.equal(visual.teamId, 'MIA');
});

test('uses canonical story types before conservative text inference', () => {
  assert.equal(
    getEditorialVisualForStory({
      teamId: 'BAL',
      storyType: 'PRACTICE',
      headline: 'Wide receivers work after practice',
    }).visualType,
    'INJURY_AVAILABILITY',
  );
  assert.equal(
    getEditorialVisualForStory({
      teamId: 'DAL',
      storyType: 'CONTRACT',
      headline: 'Team announces extension',
    }).visualType,
    'DRAFT_FRONT_OFFICE',
  );
});
