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

test('cleans uppercase fragments in otherwise naturally-cased video titles', () => {
  assert.equal(
    normalizeDisplayHeadline(
      'Andy Reid, Patrick Mahomes, and Select Players Speak to Media | SEPTEMBER 30, 2026',
    ),
    'Andy Reid, Patrick Mahomes, and Select Players Speak to Media | September 30, 2026',
  );
  assert.equal(
    normalizeDisplayHeadline('The OLD SCHOOL Chiefs offense is BACK with THIS move!'),
    'The Old School Chiefs offense is Back with This move!',
  );
  assert.equal(
    normalizeDisplayHeadline('KC QB PATRICK MAHOMES talks NFL MVP race'),
    'KC QB Patrick Mahomes talks NFL MVP race',
  );
});
test('preserves contractions and naturally-cased proper names', () => {
  assert.equal(
    normalizeDisplayHeadline("Chiefs' Trent McDuffie is ready. LET’S GO!"),
    "Chiefs' Trent McDuffie is ready. Let’s Go!",
  );
  assert.equal(
    normalizeDisplayHeadline("What's next for Kansas City?"),
    "What's next for Kansas City?",
  );
});
