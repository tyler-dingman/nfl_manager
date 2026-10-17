import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDiscoveryPreferenceStore,
  DEFAULT_DISCOVERY,
  parseDiscoveryPreferences,
} from './discovery-preferences';
import { selectDiscoveryMarkets } from './discovery-selection';
import { createResearchRequestCache } from './research-request-cache';
const alt = { altLines: true, maxOdds: -400 };
const market = (line: number, odds: number, score = 80, extra = {}) => ({
  eventId: 'e',
  playerId: 'p',
  marketType: 'PASSING_YARDS' as const,
  period: 'game',
  side: 'OVER' as const,
  line,
  odds,
  sportsbook: 'FANDUEL' as const,
  available: true,
  lineType: 'alternate' as const,
  trend: { trendScore: score },
  ...extra,
});
test('mode, actual price boundaries, distinct thresholds and best book price', () => {
  const rows = [
    market(100, -400, 92),
    market(100, -300, 92, { sportsbook: 'DRAFTKINGS' as const }),
    market(125, -401),
    market(150, 150, 82),
    market(200, -110, 70, { lineType: 'main' }),
    market(225, -110, 80, { lineType: 'unknown' }),
    market(250, null as any),
    market(275, -110, 80, { available: false }),
    market(150, 150, 83, { side: 'UNDER' }),
  ];
  const selected = selectDiscoveryMarkets(rows, alt, { includeUnqualified: true });
  assert.deepEqual(
    selected.map((m) => [m.line, m.side, m.odds]),
    [
      [100, 'OVER', -300],
      [150, 'UNDER', 150],
      [150, 'OVER', 150],
      [200, 'OVER', -110],
    ],
  );
  assert.equal(
    selectDiscoveryMarkets(rows, DEFAULT_DISCOVERY, { includeUnqualified: true })[0].line,
    200,
  );
  assert.equal(
    selectDiscoveryMarkets(rows, alt, {
      includeUnqualified: true,
      sportsbook: 'FANDUEL' as const,
    })[0].odds,
    -400,
  );
  assert.deepEqual(
    selectDiscoveryMarkets(
      [market(10, -1000), market(20, -1001)],
      { ...alt, maxOdds: -1000 },
      { includeUnqualified: true },
    ).map((m) => m.line),
    [10],
  );
});
test('preferences survive new screen subscriptions and fresh stores; hidden limit retained', async () => {
  let raw: string | null = null;
  const adapter = {
    get: () => raw,
    set: (value: string) => {
      raw = value;
    },
  };
  const store = createDiscoveryPreferenceStore(adapter);
  await store.hydrate();
  assert.deepEqual(store.getSnapshot(), { ...DEFAULT_DISCOVERY, ready: true });
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  await store.update(alt);
  unsubscribe();
  await store.update({ altLines: false });
  assert.equal(store.getSnapshot().maxOdds, -400);
  await store.update({ altLines: true });
  const refreshed = createDiscoveryPreferenceStore(adapter);
  await refreshed.hydrate();
  assert.deepEqual(refreshed.getSnapshot(), { ...alt, ready: true });
  assert.equal(notifications, 1);
  assert.deepEqual(parseDiscoveryPreferences('bad'), DEFAULT_DISCOVERY);
  assert.deepEqual(parseDiscoveryPreferences('{"maxOdds":-1200}'), DEFAULT_DISCOVERY);
});
test('late hydration cannot overwrite user action; unavailable storage stays usable', async () => {
  let resolve!: (v: string | null) => void;
  const store = createDiscoveryPreferenceStore({
    get: () =>
      new Promise<string | null>((r) => {
        resolve = r;
      }),
    set: () => {
      throw Error('blocked');
    },
  });
  const hydration = store.hydrate();
  await Promise.resolve();
  await store.update(alt);
  resolve(null);
  await hydration;
  assert.deepEqual(store.getSnapshot(), { ...alt, ready: true });
});
test('request cache reuses inflight and fresh mode requests, expires and retries errors', async () => {
  let now = 0,
    calls = 0;
  const read = createResearchRequestCache(
    async (url) => {
      calls++;
      if (url === 'fail') throw Error('fail');
      return url;
    },
    () => now,
  );
  await Promise.all([read('standard'), read('standard')]);
  assert.equal(calls, 1);
  await read('alternate');
  await read('standard');
  assert.equal(calls, 2);
  now = 60001;
  await read('standard');
  assert.equal(calls, 3);
  await assert.rejects(read('fail'));
  await assert.rejects(read('fail'));
  assert.equal(calls, 5);
});
