import test from 'node:test';
import assert from 'node:assert/strict';

import { getOffseasonManagerHref } from '@/features/team/offseason-manager-route';

test('includes selected team abbreviation when a team is active', () => {
  assert.equal(getOffseasonManagerHref('KC'), '/offseasonmanager?team=KC');
});

test('falls back to the generic offseason manager route when no team is active', () => {
  assert.equal(getOffseasonManagerHref(null), '/offseasonmanager');
  assert.equal(getOffseasonManagerHref(undefined), '/offseasonmanager');
  assert.equal(getOffseasonManagerHref(''), '/offseasonmanager');
});
