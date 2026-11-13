import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCompleteGeneratorSnapshot } from './generator-snapshot';

test('generation cannot use partial or inconsistent research', () => {
  for (const progress of [
    { complete: false, loadedEvents: 1, totalEvents: 13 },
    { complete: true, loadedEvents: 12, totalEvents: 13 },
  ])
    assert.throws(
      () => requireCompleteGeneratorSnapshot({ markets: [{ id: 'first-game' }], progress }),
      /still loading/,
    );
});
test('complete slates preserve all stored picks and empty slates are valid', () => {
  const markets = [{ id: 'one' }, { id: 'last-game' }];
  assert.equal(
    requireCompleteGeneratorSnapshot({
      markets,
      progress: { complete: true, loadedEvents: 13, totalEvents: 13 },
    }),
    markets,
  );
  assert.deepEqual(
    requireCompleteGeneratorSnapshot({
      markets: [],
      progress: { complete: true, loadedEvents: 0, totalEvents: 0 },
    }),
    [],
  );
});
test('malformed research is rejected', () => {
  assert.throws(
    () => requireCompleteGeneratorSnapshot({ markets: null as unknown as [] }),
    /unavailable/,
  );
});
