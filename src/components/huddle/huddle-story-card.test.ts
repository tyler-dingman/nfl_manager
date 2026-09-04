import assert from 'node:assert/strict';
import test from 'node:test';

import { isHotRead } from './huddle-story-card';

const now = new Date('2026-09-01T12:00:00.000Z').getTime();

test('Hot Read remains presentation-only and expires at hotReadUntil', () => {
  assert.equal(isHotRead('2026-09-01T12:01:00.000Z', now), true);
  assert.equal(isHotRead('2026-09-01T12:00:00.000Z', now), false);
  assert.equal(isHotRead('2026-09-01T11:59:00.000Z', now), false);
  assert.equal(isHotRead(null, now), false);
});
