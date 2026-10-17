import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { harness } from '../test/harness';
import { LeanEditorial, LeanR2Objects } from '../src/lean-editorial';
const h = await harness(true);
try {
  const audit = async () => {
    const dir = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
    for (const file of await readdir(dir))
      if (file.endsWith('.sqlite') && !file.includes('metadata')) {
        const a = JSON.parse(
          execFileSync('python3', ['scripts/sqlite-pages.py', join(dir, file)], {
            encoding: 'utf8',
          }),
        );
        if (a.objects.some((o: any) => o.name === 'lean_heads')) return a;
      }
    throw Error('Missing fixture');
  };
  const before = await audit(),
    objects = new LeanR2Objects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
    ),
    store = new LeanEditorial(h.db, objects, 'A'),
    start = h.db.measurements.length;
  for (let i = 0; i < 83; i++)
    await store.receipt('publication', `decision-${i}`, `story-${i}:2`, {
      id: `decision-${i}`,
      storyId: `story-${i}`,
      storyVersion: 2,
      decision: { allowed: true, reason: 'Synthetic grounded publication' },
      card: { title: `Synthetic story-${i}`, category: 'NEWS' },
      evidenceIds: [`evidence-${i}`],
      createdAt: 1800000000000,
    });
  const meters = h.db.measurements.slice(start),
    after = await audit();
  const result = {
    scope:
      'Supplemental 83 immutable publication decision/card/evidence-pin receipts, omitted from the base comparison and explicitly added to every option. Local synthetic data only.',
    rowsRead: meters.reduce((n, m) => n + m.rowsRead, 0),
    rowsWritten: meters.reduce((n, m) => n + m.rowsWritten, 0),
    ownedGrowthBytes: after.ownedBytes - before.ownedBytes,
    objectBytes: objects.bytesWritten,
    objectWrites: objects.writes,
    objectReads: objects.reads,
  };
  await writeFile(
    'measurements/zero-cost-publication.json',
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(result);
} finally {
  await h.close();
}
