import assert from 'node:assert/strict';
import test from 'node:test';

import type { CatchUpItem } from '@/features/catch-up/types';
import {
  buildThreeOutNarration,
  nextThreeOutPlayback,
  selectThreeOutCatchUpStories,
} from './catch-up-audio';
const item = (id: string, importanceScore: number, minutes = 0): CatchUpItem => ({
  id: `${id}:new:${minutes}`,
  storyId: id,
  teamId: 'KC',
  type: 'NEW',
  headline: `Headline ${id}`,
  summary: `The sourced facts for ${id}.`,
  whatChanged: 'A material update was published.',
  whyItMatters: `This is why ${id} matters.`,
  occurredAt: new Date(Date.UTC(2026, 8, 3, 12, minutes)).toISOString(),
  importanceScore,
  sourceCount: 1,
  sources: [],
  currentStoryStatus: 'DEVELOPING',
});
test('selects the three highest-ranked canonical developments and removes duplicates', () => {
  const selected = selectThreeOutCatchUpStories([
    item('low', 40),
    item('one', 95),
    item('two', 80),
    item('one', 90, 1),
    item('three', 70),
  ]);
  assert.deepEqual(
    selected.map((story) => story.storyId),
    ['one', 'two', 'three'],
  );
});

test('builds three safe narration segments with intro, transitions, and outro', () => {
  const narration = buildThreeOutNarration('KC', 'Kansas City Chiefs', [
    item('one', 95),
    item('two', 80),
    item('three', 70),
  ]);
  assert.ok(narration);
  assert.equal(narration.segments.length, 3);
  assert.match(narration.segments[0].script, /here’s your Kansas City Chiefs Three and Out/i);
  assert.match(narration.segments[1].script, /^Next one,/);
  assert.match(narration.segments[2].script, /You’re caught up\.$/);
});
test('does not render playable audio when fewer than three developments exist', () => {
  assert.equal(buildThreeOutNarration('KC', 'Kansas City Chiefs', [item('one', 95)]), null);
  assert.equal(buildThreeOutNarration('KC', 'Kansas City Chiefs', []), null);
});

test('segment completion advances deterministically and clears the active story at the end', () => {
  assert.deepEqual(nextThreeOutPlayback(0), { status: 'PLAYING', activeIndex: 1 });
  assert.deepEqual(nextThreeOutPlayback(1), { status: 'PLAYING', activeIndex: 2 });
  assert.deepEqual(nextThreeOutPlayback(2), { status: 'COMPLETE', activeIndex: null });
});
