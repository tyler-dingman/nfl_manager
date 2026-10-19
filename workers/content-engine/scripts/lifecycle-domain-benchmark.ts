/** Independent synthetic domain payload sizes; no live/provider data. */
import { encodeObject } from '../../../packages/storage/codec';
import { utf8 } from '../../../packages/storage/core';
import { mkdir, writeFile } from 'node:fs/promises';
const noise = (seed: number, n: number) => {
  let x = seed;
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    b[i] = x & 255;
  }
  return b.toString('base64');
};
const sizes: any = {
  scope:
    'Synthetic encoded JSON fixture sizes, independent per domain; raw entropy represents a sensitivity, not observed production content.',
};
const measure = async (name: string, value: unknown) => {
  const raw = utf8.encode(JSON.stringify(value));
  sizes[name] = { rawBytes: raw.length, encodedBytes: (await encodeObject(raw)).length };
};
const markets = Array.from({ length: 2000 }, (_, i) => ({
  id: `market-${i}`,
  normalizedKey: `player-${i % 200}:PASS_YARDS:OVER:${i % 20}:game`,
  playerId: `player-${i % 200}`,
  marketType: 'PASS_YARDS',
  period: 'game',
  side: 'OVER',
  sportsbook: ['book-a', 'book-b', 'book-c'][i % 3],
  isAltLine: i % 3 === 0,
  available: true,
  line: 200.5 + (i % 30),
  odds: -110 + (i % 31),
  deeplink: `https://example.invalid/book/event/market-${i}?token=${noise(i + 1, 20)}`,
}));
await measure('oddsSnapshot2000Markets', ['v', markets]);
await measure('marketIdentityDirectory2000', [
  'v',
  markets.map((m) => ({ id: m.id, normalized_key: m.normalizedKey })),
]);
await measure(
  'labScores2000',
  markets.map((m, i) => ({ id: m.id, score: i % 100, features: noise(i + 1, 80) })),
);
await measure('sourceCandidate', {
  schema: 1,
  sourceId: 'original-source',
  id: 'candidate',
  url: 'https://example.invalid/original',
  text: noise(1, 8000),
  metadata: { sourceAt: '2026-01-01T00:00:00Z', attribution: 'Original' },
});
await measure('threeAndOut', {
  schema: 1,
  id: 'original-briefing',
  team: 'KC',
  date: '2026-01-01',
  items: Array.from({ length: 3 }, (_, i) => ({
    id: 'original-' + i,
    title: 'Verified original article',
    text: noise(i + 1, 1000),
    sourceUrl: 'https://example.invalid/source-' + i,
  })),
});
await measure('frontOfficeRevision', {
  schema: 1,
  id: 'original-save',
  owner: 'original-user',
  revision: 1,
  value: {
    season: 2026,
    week: 1,
    history: noise(1, 50000),
    roster: Array.from({ length: 53 }, (_, i) => ({ id: 'player-' + i, contract: 1000000 + i })),
  },
});
await measure('savedEvidence', {
  owner: 'original-user',
  id: 'saved-original',
  marketId: 'market-original',
  price: -110,
  sourceAt: '2026-01-01',
  attribution: 'https://example.invalid/odds',
  evidence: noise(1, 2560),
});
await measure('operationDetails', {
  schema: 1,
  detail: { status: 'DONE', source: 'original-source', items: 12, body: noise(1, 1024) },
});
await mkdir('../../reports/historical-lifecycle', { recursive: true });
await writeFile(
  '../../reports/historical-lifecycle/domain-sizes.json',
  JSON.stringify(sizes, null, 2) + '\n',
);
