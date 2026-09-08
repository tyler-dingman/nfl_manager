import assert from 'node:assert/strict';
import test from 'node:test';

import { VERIFIED_VIDEO_SOURCES } from './video-source-sync';

test('verified video manifest has unique source and channel IDs', () => {
  const sourceIds = VERIFIED_VIDEO_SOURCES.map(([, id]) => id);
  const channelIds = VERIFIED_VIDEO_SOURCES.map(([, , , channelId]) => channelId);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(new Set(channelIds).size, channelIds.length);
});

test('verified video manifest covers every team with at least one channel', () => {
  const teams = new Set(
    VERIFIED_VIDEO_SOURCES.flatMap(([teamId]) => (teamId ? [teamId] : [])),
  );
  // GB, LV, and NE currently have a verified team podcast while their official
  // channel remains unresolved, so all 32 teams still receive video coverage.
  assert.equal(teams.size, 32);
});
