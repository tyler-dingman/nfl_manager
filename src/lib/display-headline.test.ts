import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDisplayHeadline } from './display-headline';

test('normalizes all-caps editorial headlines while preserving football acronyms', () => {
  assert.equal(
    normalizeDisplayHeadline('PATRICK MAHOMES EXPECTED TO START IN WEEK 1'),
    'Patrick Mahomes Expected to Start in Week 1',
  );
  assert.equal(
    normalizeDisplayHeadline('CHIEFS SIGN CB FROM PRACTICE SQUAD'),
    'Chiefs Sign CB from Practice Squad',
  );
});

test('removes social prefixes and trailing hashtag dumps', () => {
  assert.equal(
    normalizeDisplayHeadline(
      "UPDATE: PATRICK MAHOMES 'EXPECTED' TO START IN WEEK 1 #NFL #CHIEFS #SHORTS",
    ),
    'Patrick Mahomes Expected to Start in Week 1',
  );
});

test('leaves naturally-cased headlines intact', () => {
  assert.equal(
    normalizeDisplayHeadline('Patrick Mahomes Expected to Start in Week 1'),
    'Patrick Mahomes Expected to Start in Week 1',
  );
});
