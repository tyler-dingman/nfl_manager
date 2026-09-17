import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptDraftNewsGraphic,
  comparableRankDirection,
  normalizeStoryTemplate,
} from './story-graphic-model';

test('lower rank numbers are positive movement', () => {
  assert.deepEqual(comparableRankDirection(14, 8), { movement: 6, direction: 'up' });
  assert.deepEqual(comparableRankDirection(7, 12), { movement: -5, direction: 'down' });
  assert.deepEqual(comparableRankDirection(8, 8), { movement: 0, direction: 'steady' });
});
test('missing or invalid ranks do not invent movement', () => {
  assert.equal(comparableRankDirection(undefined, 8), null);
  assert.equal(comparableRankDirection(0, 8), null);
});
test('unknown story types use the neutral template', () => {
  assert.equal(normalizeStoryTemplate('not-a-template'), 'generic');
});
test('draft news is classified only from comparable ranks', () => {
  assert.equal(
    adaptDraftNewsGraphic({ id: '1', headline: 'Story', previousRank: 14, currentRank: 8 })
      .template,
    'rising-prospect',
  );
  assert.equal(adaptDraftNewsGraphic({ id: '2', headline: 'Story' }).template, 'generic');
});

test('known schools resolve an accent and unknown schools stay neutral', () => {
  const known = adaptDraftNewsGraphic({ id: '3', headline: 'Story', school: 'Ohio St.' });
  const unknown = adaptDraftNewsGraphic({ id: '4', headline: 'Story', school: 'Unknown College' });
  assert.equal(known.primaryIdentity?.primary, '#BB0000');
  assert.equal(unknown.primaryIdentity?.primary, undefined);
});
