import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { harness } from '../test/harness';
import { LeanEditorial, LeanR2Objects } from '../src/lean-editorial';
import { MirroredEditorialObjects } from '../src/mirrored-editorial';
const h = await harness();
try {
  const primary = new LeanR2Objects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    ),
    backup = new LeanR2Objects((await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as R2Bucket),
    mirror = new MirroredEditorialObjects(primary, backup),
    store = new LeanEditorial(h.db, mirror, 'A');
  for (let i = 0; i < 20; i++)
    await store.put({
      kind: 'story',
      id: `full-${i}`,
      headline: `Original ${i}`,
      category: 'NEWS',
      sourceId: 'source-1',
      publishedAt: 1800000000000,
      teamIds: ['kc', 'sea'],
      payload: {
        id: `full-${i}`,
        headline: `Original ${i}`,
        body: 'Original sourced content. '.repeat(350),
        sourceId: 'source-1',
        author: 'Original reporter',
      },
    });
  await store.put({
    kind: 'candidate',
    id: 'largest',
    headline: 'Near-limit source',
    category: 'source',
    sourceId: 'source-1',
    publishedAt: 1800000000000,
    teamIds: ['kc'],
    payload: { id: 'largest', rawText: 'x'.repeat(490000) },
  });
  if (((await store.get('candidate', 'largest'))?.payload as any).rawText.length !== 490000)
    throw Error('Near-limit roundtrip failed');
  const results: any = {};
  for (const [name, fn] of [
    ['article', () => store.get('story', 'full-0')],
    ['homeFullPayload', () => store.fullFeed('kc', 'story', 20)],
    ['teamFullPayload', () => store.fullFeed('sea', 'story', 20)],
    ['historical', () => store.get('story', 'full-0', 1)],
    ['historicalMetadataSearch', () => store.history('source-1')],
  ] as const) {
    const times = [],
      cpu = process.cpuUsage(),
      start = h.db.measurements.length,
      gets = primary.reads + backup.reads;
    for (let n = 0; n < 10; n++) {
      const t = performance.now();
      await fn();
      times.push(performance.now() - t);
    }
    const usage = process.cpuUsage(cpu);
    times.sort((a, b) => a - b);
    results[name] = {
      samples: 10,
      medianMs: (times[4] + times[5]) / 2,
      maxMs: times[9],
      hostCpuMsPerSample: (usage.user + usage.system) / 10000,
      rowsRead: h.db.measurements.slice(start).reduce((n, m) => n + m.rowsRead, 0),
      r2Reads: primary.reads + backup.reads - gets,
    };
  }
  await writeFile(
    'measurements/zero-cost-full-feed.json',
    JSON.stringify(
      {
        scope:
          'Selected A with two real local R2 buckets. Twenty full ~8KB article payloads per feed. Four concurrent object reads maximum. Ten samples each; host CPU excludes workerd and is not production Worker CPU. Includes one 490KB source roundtrip; no application API/browser integration.',
        primaryWrites: primary.writes,
        backupWrites: backup.writes,
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await h.close();
}
