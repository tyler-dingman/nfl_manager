import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getActiveThreeOutSection } from './tts-provider';

const starts = [0, 11.45, 23.1] as const;

test('currentTime zero activates only section 01', () => {
  assert.equal(getActiveThreeOutSection(0, starts), 0);
});

test('a playback position inside section 02 activates only section 02', () => {
  assert.equal(getActiveThreeOutSection(17, starts), 1);
});

test('a playback position inside section 03 activates only section 03', () => {
  assert.equal(getActiveThreeOutSection(29, starts), 2);
});

test('seeking from section 03 back to section 01 recalculates immediately', () => {
  assert.equal(getActiveThreeOutSection(29, starts), 2);
  assert.equal(getActiveThreeOutSection(4, starts), 0);
});

test('pause does not affect the section derived from currentTime', () => {
  const pausedAt = 17;
  assert.equal(getActiveThreeOutSection(pausedAt, starts), 1);
  assert.equal(getActiveThreeOutSection(pausedAt, starts), 1);
});

test('every playback position resolves to exactly one active section', () => {
  for (const currentTime of [0, 4, 11.45, 17, 23.1, 29, 33.52]) {
    const activeIndex = getActiveThreeOutSection(currentTime, starts);
    assert.equal(starts.filter((_, index) => index === activeIndex).length, 1);
  }
});

test('active bubble uses the shared semantic team-primary fill contract', () => {
  const component = readFileSync('src/components/catch-up/three-out-audio-card.tsx', 'utf8');
  assert.match(component, /active\s*\?\s*'team-primary-filled'/);
  assert.match(component, /'bg-slate-200 text-\[#00172B\]'/);
});
