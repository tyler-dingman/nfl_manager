import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSearchAnswerCitations } from './citations';

test('turns valid one-based answer citations into zero-based source references', () => {
  assert.deepEqual(parseSearchAnswerCitations('First [1] and third [3].', 3), [
    { type: 'text', value: 'First ' },
    { type: 'citation', value: '[1]', sourceIndex: 0 },
    { type: 'text', value: ' and third ' },
    { type: 'citation', value: '[3]', sourceIndex: 2 },
    { type: 'text', value: '.' },
  ]);
});

test('leaves out-of-range citation markers as plain text', () => {
  assert.deepEqual(parseSearchAnswerCitations('Missing [4].', 3), [
    { type: 'text', value: 'Missing ' },
    { type: 'text', value: '[4]' },
    { type: 'text', value: '.' },
  ]);
});
