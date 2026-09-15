import assert from 'node:assert/strict';
import test from 'node:test';

import type { RegisteredSource } from '@/features/story-engine/types';
import { assertSafeRegisteredUrl } from './fetcher';

const source = {
  url: 'https://www.raisingzona.com/',
  feedUrl: 'https://www.raisingzona.com/feed/',
} as RegisteredSource;

test('allows a registered feed to redirect between www and apex host', () => {
  assert.equal(
    assertSafeRegisteredUrl('https://raisingzona.com/feed', source).hostname,
    'raisingzona.com',
  );
});

test('still rejects redirects to an unrelated host', () => {
  assert.throws(
    () => assertSafeRegisteredUrl('https://example.com/feed', source),
    /not allowlisted/,
  );
});
