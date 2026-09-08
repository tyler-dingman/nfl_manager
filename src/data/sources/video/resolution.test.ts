import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exactApprovedChannelMatch,
  normalizeYouTubeChannelName,
  videoResolutionPriority,
} from './resolution';

test('normalizes harmless channel-title punctuation differences', () => {
  assert.equal(normalizeYouTubeChannelName('SHOUT! Buffalo Football'), 'shout buffalo football');
  assert.equal(normalizeYouTubeChannelName('Film & Football'), 'film and football');
});

test('accepts one exact approved channel title and refuses guesses', () => {
  const exact = { id: { channelId: 'trusted' }, snippet: { channelTitle: 'Locked On Bears' } };
  const similar = { id: { channelId: 'wrong' }, snippet: { channelTitle: 'Locked On Bears Fan' } };
  assert.equal(exactApprovedChannelMatch('Locked On Bears', [similar, exact]), exact);
  assert.equal(exactApprovedChannelMatch('Locked On Bears', [similar]), null);
  assert.equal(exactApprovedChannelMatch('Locked On Bears', [exact, { ...exact }]), null);
});

test('resolves official and podcast channels before lower-priority sources', () => {
  assert.ok(videoResolutionPriority('official') < videoResolutionPriority('podcast'));
  assert.ok(videoResolutionPriority('podcast') < videoResolutionPriority('film'));
  assert.ok(videoResolutionPriority('film') < videoResolutionPriority('creator'));
});
