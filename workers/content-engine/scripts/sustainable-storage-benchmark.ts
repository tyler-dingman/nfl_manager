import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { repackLegacyPayload } from '../../../packages/storage/repack';
import { D1Objects } from '../../../packages/storage/d1-objects';
import {
  collectPayloadGarbage,
  storageCapacity,
} from '../../../packages/storage/garbage-collection';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const out = process.env.DD_STORAGE_REPORT_DIR || '../../reports/sustainable-storage';
await mkdir(out, { recursive: true });
function text(seed: number, n: number) {
  let x = seed;
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    b[i] = x & 255;
  }
  return b.toString('base64');
}
async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (p.endsWith('.sqlite')) out.push(p);
  }
  return out;
}
async function physical(h: Awaited<ReturnType<typeof harness>>) {
  let file = '';
  for (const candidate of await files(h.directory)) {
    const r = spawnSync(
      '/usr/bin/sqlite3',
      [
        '-readonly',
        candidate,
        "SELECT count(*) FROM sqlite_schema WHERE name='app_payload_objects'",
      ],
      { encoding: 'utf8' },
    );
    if (r.status === 0 && r.stdout.trim() === '1') {
      file = candidate;
      break;
    }
  }
  if (!file) throw Error('Synthetic application SQLite file not found');
  const query = (sql: string) => {
    const r = spawnSync('/usr/bin/sqlite3', ['-readonly', '-json', file, sql], {
      encoding: 'utf8',
    });
    if (r.status !== 0) throw Error(r.stderr);
    return JSON.parse(r.stdout || '[]');
  };
  const [pages] = query(
    'SELECT (SELECT page_count FROM pragma_page_count) AS pageCount,(SELECT page_size FROM pragma_page_size) AS pageSize,(SELECT freelist_count FROM pragma_freelist_count) AS freelist',
  );
  return {
    ...pages,
    sqliteBytes: pages.pageCount * pages.pageSize,
    tables: query(
      'SELECT name,sum(pgsize) AS bytes,count(*) AS pages FROM dbstat GROUP BY name ORDER BY bytes DESC',
    ),
  };
}
const results: any = {
  scope:
    'MEASURED local synthetic SQLite pages/dbstat; fixture categories are not live application proportions.',
  categories: [],
  localWorkerCpuMs: null,
};
for (const legacy of [true, false]) {
  const h = await harness(true, true, 999, undefined, false);
  try {
    const raw = h.binding as unknown as SqlDatabase,
      metrics = requestMetrics();
    const fresh = () => new Storage(raw, new D1Objects(instrumentDatabase(raw, metrics)));
    let s = fresh();
    const baseline = await physical(h);
    await s
      .statement(
        "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','owner@example.invalid','ACTIVE',1,1)",
      )
      .run();
    let seed = 1;
    for (const category of [
      'editorial',
      'three-and-out',
      'ai-cache',
      'search',
      'parlay-scores',
      'odds-current',
      'front-office',
      'ingestion',
      'background-jobs',
      'orphan',
    ]) {
      let rawBytes = 0,
        encodedBytes = 0;
      for (let i = 0; i < 3; i++) {
        const value = {
          category,
          id: category + '-' + i,
          attribution: 'https://example.invalid/original',
          text: text(seed++, 32768),
        };
        const hash = await s.put(value);
        await s.put(value);
        rawBytes += Buffer.byteLength(JSON.stringify(value));
        encodedBytes += (
          await raw
            .prepare('SELECT bytes FROM app_payload_objects WHERE hash=?')
            .bind(hash)
            .first<any>()
        ).bytes;
        if (category === 'ai-cache')
          await s
            .statement(
              'INSERT INTO app_ai_cache(cache_key,object_hash,source_version,expires_at,lease_until) VALUES(?,?,?,1,0)',
              [category + i, hash, 'original'],
            )
            .run();
        else if (category !== 'orphan')
          await s
            .statement(
              'INSERT INTO app_history_packs(id,kind,object_hash,rows,created_at) VALUES(?,?,?,1,1)',
              [category + i, category, hash],
            )
            .run();
      }
      if (!legacy)
        results.categories.push({
          category,
          objects: 3,
          rawBytes,
          encodedBytes,
          policy:
            category === 'ai-cache'
              ? 'existing expiry'
              : category === 'orphan'
                ? 'unreferenced'
                : 'retained',
        });
    }
    if (legacy)
      for (const row of (
        await raw.prepare('SELECT hash FROM app_payload_objects').all<{ hash: string }>()
      ).results)
        await repackLegacyPayload(raw, row.hash, 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED', 'base64');
    const before = await physical(h),
      capacityBefore = await storageCapacity(raw);
    const preview = await collectPayloadGarbage(raw, {
        dryRun: true,
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
      }),
      rounds = [];
    for (let i = 0; i < 3; i++)
      rounds.push(
        await collectPayloadGarbage(raw, {
          dryRun: false,
          expireDerived: true,
          acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
        }),
      );
    const after = await physical(h),
      capacityAfter = await storageCapacity(raw);
    s = fresh();
    for (let i = 0; i < 6; i++) await s.put({ replacement: i, text: text(100 + i, 32768) });
    const reuse = await physical(h);
    results[legacy ? 'legacyBase64' : 'binary'] = {
      baseline,
      before,
      after,
      reuse,
      capacityBefore,
      capacityAfter,
      preview,
      rounds,
      metrics,
      reusedExistingPages: reuse.pageCount <= after.pageCount,
      physicalFileShrinkBytes: Math.max(0, before.sqliteBytes - after.sqliteBytes),
    };
  } finally {
    await h.close();
  }
}
results.smallObjects = {};
for (const legacy of [true, false]) {
  const h = await harness(true, true, 999, undefined, false);
  try {
    const db = h.binding as unknown as SqlDatabase;
    const baseline = await physical(h);
    const s = new Storage(db, new D1Objects(db));
    for (let i = 0; i < 200; i++) {
      const hash = await new Storage(db, new D1Objects(db)).put({
        id: i,
        attribution: 'https://example.invalid/original',
        title: 'Small immutable content',
        score: i % 100,
      });
      if (legacy)
        await repackLegacyPayload(db, hash, 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED', 'base64');
    }
    const after = await physical(h);
    results.smallObjects[legacy ? 'legacyChunks' : 'inline'] = {
      objects: 200,
      baseline,
      after,
      incrementalSqliteBytes: after.sqliteBytes - baseline.sqliteBytes,
    };
  } finally {
    await h.close();
  }
}
await writeFile(out + '/storage-benchmark.json', JSON.stringify(results, null, 2) + '\n');
console.log(
  JSON.stringify({
    before: results.legacyBase64.before.sqliteBytes,
    binaryBefore: results.binary.before.sqliteBytes,
    binaryAfterGc: results.binary.after.sqliteBytes,
    freelistBefore: results.binary.before.freelist,
    freelistAfter: results.binary.after.freelist,
    reusedExistingPages: results.binary.reusedExistingPages,
  }),
);
