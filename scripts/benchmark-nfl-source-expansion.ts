import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { parseRssOrAtom } from '../src/features/story-engine/rss';
import { normalizeRawItem } from '../src/features/story-engine/normalization';
import type { RegisteredSource } from '../src/features/story-engine/types';
import { sourceExpansionModel } from '../src/data/sources/research/cost-model';
import summary from '../reports/source-expansion/summary.json';

const source = {
  id: 'SYNTHETIC',
  teamId: 'BUF',
  pollingTier: 'B',
  metadata: {},
} as RegisteredSource;
const results = [
  { name: 'typical', items: 25, excerptBytes: 1024, iterations: 100 },
  { name: 'large', items: 25, excerptBytes: 8192, iterations: 50 },
  { name: 'near-feed-cap', items: 100, excerptBytes: 9000, iterations: 20 },
].map((scenario) => {
  const xml =
    '<rss><channel>' +
    Array.from(
      { length: scenario.items },
      (_, i) =>
        `<item><title>Bills practice report ${i}</title><guid>${i}</guid><link>https://fixture.example/${i}</link><pubDate>2026-10-16T12:00:00Z</pubDate><description>${'permitted synthetic text '.repeat(Math.ceil(scenario.excerptBytes / 25)).slice(0, scenario.excerptBytes)}</description></item>`,
    ).join('') +
    '</channel></rss>';
  const samples: number[] = [];
  let parsed = 0;
  for (let i = 0; i < scenario.iterations; i++) {
    const start = performance.now();
    parsed = parseRssOrAtom(xml, source).map((item) => normalizeRawItem(item, source)).length;
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    ...scenario,
    wireBytes: Buffer.byteLength(xml),
    parsed,
    meanNodeWallMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p95NodeWallMs: samples[Math.ceil(samples.length * 0.95) - 1],
    productionWorkerCpuMs: null,
    databaseReadsMeasured: false,
    databaseWritesMeasured: false,
  };
});
writeFileSync(
  'reports/source-expansion/local-benchmark.json',
  JSON.stringify(
    {
      runtime: process.version,
      scope:
        'Synthetic RSS parsing, normalization and SHA-256; Node wall time only. No network, DB, model calls, or Worker CPU measurement.',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(results);
writeFileSync(
  'reports/source-expansion/cost-scenarios.json',
  JSON.stringify(
    [
      ['current-reference-only', 0, 200],
      ['launch', 1000, 400],
      ['2x-launch', 2000, 800],
      ['5x-launch', 5000, 2000],
    ].map(([label, dau, items]) => ({
      label,
      ...sourceExpansionModel({
        dau: Number(dau),
        feeds: summary.technicalFeedSources,
        checksPerFeedPerDay: 8,
        uniqueCandidatesPerDay: Number(items),
      }),
    })),
    null,
    2,
  ) + '\n',
);
