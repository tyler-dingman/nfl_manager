import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCatchMeUp } from './content-state';

test('Catch Me Up counts only material changes after the previous visit', () => {
  const result = buildCatchMeUp({
    previousVisit: { lastVisitedAt: '2026-08-30T10:00:00.000Z', lastSeenSnapshotId: 'old' },
    currentSnapshotId: 'new',
    stories: [
      { id: 'updated', title: 'Updated', lastMaterialUpdateAt: '2026-08-30T11:00:00.000Z' },
      { id: 'old', title: 'Old', lastMaterialUpdateAt: '2026-08-30T09:00:00.000Z' },
    ],
    currentAudioVersion: 'v2',
    previousAudioVersion: 'v1',
  });
  assert.deepEqual(result.materiallyUpdatedStoryIds, ['updated']);
  assert.equal(result.newDevelopmentCount, 1);
  assert.equal(result.newAudio, true);
  assert.equal(result.hasUpdates, true);
});

test('a first visit has no Catch Me Up banner', () => {
  const result = buildCatchMeUp({
    previousVisit: null,
    currentSnapshotId: 'current',
    stories: [],
  });
  assert.equal(result.hasUpdates, false);
  assert.equal(result.newAudio, false);
});