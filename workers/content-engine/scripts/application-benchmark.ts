import { harness } from '../test/harness';
import { Storage, ApplicationDocuments, type SqlDatabase } from '../../../packages/storage/core';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1UserRepository } from '../../../packages/storage/user';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const h = await harness(true);
try {
  const metrics = requestMetrics(),
    objects = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
    ),
    s = new Storage(instrumentDatabase(h.binding as unknown as SqlDatabase, metrics), objects),
    auth = new D1AuthRepository(s),
    users = new D1UserRepository(s),
    docs = new ApplicationDocuments(s);
  const audit = async () => {
    const directory = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
    for (const file of await readdir(directory)) {
      if (!file.endsWith('.sqlite') || file.includes('metadata')) continue;
      const value = JSON.parse(
        execFileSync('python3', ['scripts/sqlite-pages.py', join(directory, file)], {
          encoding: 'utf8',
        }),
      );
      if (value.objects.some((o: any) => o.name === 'app_users')) return value;
    }
    throw Error('Synthetic D1 file not found');
  };
  const before = await audit(),
    start = performance.now(),
    samples: Record<string, unknown>[] = [];
  for (let i = 0; i < 100; i++) {
    const user = (await auth.createEmailUser({
      email: `bench-${i}@example.invalid`,
      passwordHash: 'preserved-hash-metadata-only-no-hashing-benchmark',
    }))!;
    await auth.createSession({ userId: user.id, token: `synthetic-session-${i}` });
    await users.updatePreferences(user.id, {
      preferredTeamId: i % 2 ? 'SEA' : 'KC',
      reducedMotion: true,
    });
    for (let j = 0; j < 5; j++)
      await users.saveContent(user.id, {
        contentType: 'STORY',
        contentId: `original-${j}`,
        title: 'Original saved article',
        href: `/the-beat/original-${j}`,
        metadata: { sourceId: 'original-source', context: 'x'.repeat(400) },
      });
    await users.saveContent(user.id, {
      contentType: 'OTHER',
      contentId: `saved-slip-${i}`,
      title: 'Saved slip',
      metadata: {
        legs: Array.from({ length: 20 }, (_, j) => ({
          originalMarketId: `market-${j}`,
          line: j,
          price: -110,
          book: 'FANDUEL',
        })),
      },
    });
    const t = performance.now(),
      previous = { ...metrics };
    await users.getPreferences(user.id);
    samples.push({
      operation: 'preferences.read',
      localWallMs: performance.now() - t,
      rowsRead: metrics.rowsRead - previous.rowsRead,
      rowsWritten: metrics.rowsWritten - previous.rowsWritten,
    });
    if (i === 0) {
      const worst = randomBytes(1050000).toString('hex');
      await docs.commit(user.id, 'front-office', 'original-save', 0, crypto.randomUUID(), {
        state: worst,
      });
      for (let revision = 1; revision <= 10; revision++)
        await docs.commit(user.id, 'front-office', 'original-save', revision, crypto.randomUUID(), {
          state: worst,
          revision,
        });
      await assert.rejects(
        docs.commit(user.id, 'front-office', 'original-save', 11, crypto.randomUUID(), {
          state: 'x'.repeat(4000000),
        }),
        /exceeds 4 MB/,
      );
      assert.equal((await docs.read(user.id, 'front-office', 'original-save'))?.revision, 11);
    }
  }
  const after = await audit();
  await writeFile(
    '../../reports/zero-cost-phase-3/application-storage-benchmark.json',
    JSON.stringify(
      {
        scope:
          'MEASURED 100 synthetic accounts, one session/account, six saved records/account, 11 unique high-entropy 2.1 MB game documents with two verified copies. Generic aggregate storage, not migrated gameplay routes.',
        accounts: 100,
        before,
        after,
        incrementalD1Bytes: after.sqliteBytes - before.sqliteBytes,
        ...metrics,
        r2: { reads: objects.reads, writes: objects.writes, writtenBytes: objects.bytes },
        localWallMs: performance.now() - start,
        readSamples: samples,
        workerCpuMs: null,
        oversizeRejectedWithoutHeadChange: true,
      },
      null,
      2,
    ),
  );
} finally {
  await h.close();
}
