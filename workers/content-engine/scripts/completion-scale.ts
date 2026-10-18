import { JsonTree } from '../../../packages/storage/json-tree';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import assert from 'node:assert/strict';
import { writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ReferenceData } from '../../../packages/storage/reference';
import { harness } from '../test/harness';
import { Storage, ApplicationDocuments, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { checkpoint, restore, type SnapshotObjects } from '../../../packages/storage/cold-recovery';
const out = '../../reports/production-completion/';
const h = await harness(true),
  b = await harness(),
  t = await harness();
const secret = 'synthetic-phase-four-only-key-at-least-32-characters';
function raw(bucket: any) {
  const counts = { reads: 0, writes: 0, lists: 0, bytesWritten: 0 };
  const objects: SnapshotObjects = {
    keys: async () => {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        counts.lists++;
        const p = await bucket.list({ cursor });
        keys.push(...p.objects.map((v: any) => v.key));
        cursor = p.truncated ? p.cursor : undefined;
      } while (cursor);
      return keys;
    },
    get: async (key) => {
      counts.reads++;
      const v = await bucket.get(key);
      return v ? new Uint8Array(await v.arrayBuffer()) : null;
    },
    putImmutable: async (key, bytes) => {
      counts.reads++;
      const old = await bucket.get(key);
      if (old) assert.deepEqual(new Uint8Array(await old.arrayBuffer()), bytes);
      else {
        counts.writes++;
        counts.bytesWritten += bytes.length;
        await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' } });
      }
    },
  };
  return { counts, objects };
}
try {
  const metrics = requestMetrics(),
    source = raw(await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')),
    bodyBackup = raw(await b.mf.getR2Bucket('EDITORIAL_ARCHIVE')),
    target = raw(await t.mf.getR2Bucket('EDITORIAL_ARCHIVE')),
    objectStore = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
    ),
    s = new Storage(instrumentDatabase(h.binding as unknown as SqlDatabase, metrics), objectStore),
    backupStore = new PrivateObjects(
      (await b.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
    ),
    backup = new Storage(b.binding as unknown as SqlDatabase, backupStore);
  const backupD1Metrics = requestMetrics(),
    restoreD1Metrics = requestMetrics();
  const recoveryDb = instrumentDatabase(h.binding as unknown as SqlDatabase, backupD1Metrics);
  const targetDb = instrumentDatabase(t.binding as unknown as SqlDatabase, restoreD1Metrics);
  const now = Date.now();
  let batch: any[] = [];
  const push = async (sql: string, values: unknown[]) => {
    batch.push(s.statement(sql, values));
    if (batch.length === 40) {
      await s.batch(batch);
      batch = [];
    }
  };
  for (let i = 0; i < 5000; i++) {
    const user = `synthetic-user-${i}`;
    await push(
      "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES(?,?,'ACTIVE',?,?)",
      [user, `user-${i}@example.invalid`, now, now],
    );
    await push('INSERT INTO app_credentials(user_id,password_hash) VALUES(?,?)', [
      user,
      'synthetic-original-hash-not-real-credentials',
    ]);
    await push('INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES(?,?,?)', [
      user,
      JSON.stringify({ preferredTeamId: i % 2 ? 'SEA' : 'KC', reducedMotion: true }),
      now,
    ]);
    await push(
      'INSERT INTO app_sessions(id,user_id,refresh_token_hash,token_family_id,expires_at,created_at,last_used_at) VALUES(?,?,?,?,?,?,?)',
      [`session-${i}`, user, `original-session-hash-${i}`, `family-${i}`, now + 86400000, now, now],
    );
    await push(
      "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES(?,?,'OTHER',?,'Original saved bet',?,?)",
      [
        `saved-${i}`,
        user,
        `bet-original-${i}`,
        JSON.stringify({
          legs: Array.from({ length: 8 }, (_, j) => ({
            marketId: `original-${j}`,
            book: 'FANDUEL',
            price: -110,
            line: j,
            asOf: '2026-10-18T15:00:00Z',
          })),
        }),
        now,
      ],
    );
  }
  if (batch.length) await s.batch(batch);
  const docs = new ApplicationDocuments(s),
    sharedPlayers = Array.from({ length: 256 }, (_, i) => ({
      id: `player-${i}`,
      contract: randomBytes(96).toString('hex'),
      team: 'KC',
      cap: 1000000,
    }));
  let fullSnapshotBytes = 0;
  const historyStart = objectStore.bytes,
    historyReads = objectStore.reads,
    historyWrites = objectStore.writes;
  for (let i = 0; i < 100; i++)
    for (let revision = 0; revision < 4; revision++) {
      const value = {
        players: sharedPlayers,
        season: 2026,
        week: revision,
        progress: { owner: `synthetic-user-${i}`, score: i + revision },
        transactions: Array.from({ length: revision }, (_, j) => ({
          id: `original-event-${i}-${j}`,
          type: 'TRADE',
          yardage: j,
        })),
      };
      fullSnapshotBytes += Buffer.byteLength(
        JSON.stringify({
          schema: 1,
          owner: `synthetic-user-${i}`,
          kind: 'front-office',
          id: `save-${i}`,
          revision: revision + 1,
          value,
        }),
      );
      await docs.commit(
        `synthetic-user-${i}`,
        'front-office',
        `save-${i}`,
        revision,
        `original-command-${i}-${revision}`,
        value,
      );
    }
  const gameBytes = objectStore.bytes - historyStart;
  const gameReads = objectStore.reads - historyReads,
    gameWrites = objectStore.writes - historyWrites;
  for (let i = 0; i < 1000; i++)
    await s.put({
      schema: 1,
      kind: i < 30 ? 'editorial' : 'historical-odds',
      id: `source-original-${i}`,
      asOf: '2026-10-18T15:00:00Z',
      attribution: 'Synthetic source',
      body: 'Retained source and immutable history. '.repeat(200),
      markets: Array.from({ length: 50 }, (_, j) => ({
        id: `market-${j}`,
        book: 'FANDUEL',
        line: j,
        odds: -110,
      })),
    });
  const refs = new ReferenceData(s);
  for (let i = 0; i < 100; i++) {
    const root = await new JsonTree(s).put({
      referenceHash: await s.put({ kind: 'original-reference', players: sharedPlayers }),
      metadata: { saveId: `native-save-${i}`, version: 1 },
      encoded: { week: i % 18, originalIDs: sharedPlayers.map((p) => p.id) },
    });
    const objectHash = await s.put({
      schema: 1,
      owner: `synthetic-user-${i}`,
      saveId: `native-save-${i}`,
      version: 1,
      root,
    });
    await s
      .statement(
        'INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          `synthetic-user-${i}`,
          `native-save-${i}`,
          'KC',
          2026,
          'REGULAR_SEASON',
          1,
          objectHash,
          now,
          now,
        ],
      )
      .run();
    await refs.put('RECOVERY_FIXTURE', `original-reference-${i}`, 'KC', 2026, {
      id: `original-reference-${i}`,
      source: 'Synthetic attribution',
      payload: randomBytes(1024).toString('hex'),
    });
  }
  for (let i = 0; i < 10; i++)
    await new D1OddsBoard(s).publish(
      {
        providerEventId: `original-provider-${i}`,
        season: 2026,
        week: 9,
        homeTeamId: 'KC',
        awayTeamId: 'DEN',
        kickoffAt: new Date(now + 86400000),
        status: 'scheduled',
      },
      Array.from({ length: 200 }, (_, j) => ({
        id: `original-market-${i}-${j}`,
        normalizedKey: `original-key-${j}`,
        sportsbook: 'FANDUEL',
        odds: -110,
        line: j,
        available: true,
      })),
      now,
      `original-event-${i}`,
    );
  const worstStart = { reads: objectStore.reads, writes: objectStore.writes };
  await docs.commit(
    'synthetic-user-4999',
    'front-office',
    'worst-size',
    0,
    'worst-command-original',
    { opaque: randomBytes(1050000).toString('hex') },
  );
  const worstObjectOperations = {
    reads: objectStore.reads - worstStart.reads,
    writes: objectStore.writes - worstStart.writes,
  };
  assert(worstObjectOperations.reads + worstObjectOperations.writes < 500);
  const sqlite = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
  let pages: any;
  for (const file of await readdir(sqlite))
    if (file.endsWith('.sqlite') && !file.includes('metadata')) {
      const audit = JSON.parse(
        execFileSync('python3', ['scripts/sqlite-pages.py', join(sqlite, file)], {
          encoding: 'utf8',
        }),
      );
      if (audit.objects.some((o: any) => o.name === 'app_users')) pages = audit;
    }
  assert(pages);
  let failedWrites = 0;
  await assert.rejects(
    checkpoint(
      recoveryDb,
      source.objects,
      backup,
      {
        ...bodyBackup.objects,
        putImmutable: async (k, v) => {
          if (++failedWrites === 3) throw Error('Injected partial backup');
          return bodyBackup.objects.putImmutable(k, v);
        },
      },
      secret,
      'OFFLINE_WRITERS_STOPPED',
    ),
    /Injected/,
  );
  const copied = await checkpoint(
    recoveryDb,
    source.objects,
    backup,
    bodyBackup.objects,
    secret,
    'OFFLINE_WRITERS_STOPPED',
  );
  const previousWrites = backupStore.writes,
    previousBodyWrites = bodyBackup.counts.writes;
  const repeated = await checkpoint(
    recoveryDb,
    source.objects,
    backup,
    bodyBackup.objects,
    secret,
    'OFFLINE_WRITERS_STOPPED',
    copied.id,
  );
  assert.equal(repeated.id, copied.id);
  assert(repeated.reusedCheckpoint);
  assert.equal(backupStore.writes, previousWrites);
  assert.equal(bodyBackup.counts.writes, previousBodyWrites);
  let restoredChunks = 0;
  await assert.rejects(
    restore(
      targetDb,
      target.objects,
      backup,
      bodyBackup.objects,
      secret,
      copied.id,
      'OFFLINE_WRITERS_STOPPED',
      () => {
        if (++restoredChunks === 15) throw Error('Injected interruption');
      },
    ),
    /Injected/,
  );
  const restored = await restore(
    targetDb,
    target.objects,
    backup,
    bodyBackup.objects,
    secret,
    copied.id,
    'OFFLINE_WRITERS_STOPPED',
  );
  const replay = await restore(
    targetDb,
    target.objects,
    backup,
    bodyBackup.objects,
    secret,
    copied.id,
    'OFFLINE_WRITERS_STOPPED',
  );
  assert.equal(replay.status, 'READY');
  const targetStorage = new Storage(
    t.binding as unknown as SqlDatabase,
    new PrivateObjects((await t.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
  );
  assert.equal((await targetStorage.rows('SELECT id FROM app_users')).length, 5000);
  assert.equal((await targetStorage.rows('SELECT id FROM app_saved_content')).length, 5000);
  assert.equal(
    (await new ApplicationDocuments(targetStorage).read<any>(
      'synthetic-user-50',
      'front-office',
      'save-50',
    ))!.value.week,
    3,
  );
  assert.equal(
    (await new ApplicationDocuments(targetStorage).read<any>(
      'synthetic-user-4999',
      'front-office',
      'worst-size',
    ))!.value.opaque.length,
    2100000,
  );
  assert.equal((await targetStorage.rows('PRAGMA foreign_key_check')).length, 0);
  assert.equal((await new D1OddsBoard(targetStorage).markets('original-event-5')).length, 200);
  assert.equal(
    (await new D1OddsBoard(targetStorage).markets('original-event-5'))[0].id,
    'original-market-5-0',
  );
  assert.equal((await targetStorage.rows('SELECT * FROM app_franchise_heads')).length, 100);
  assert.equal((await new ReferenceData(targetStorage).values('RECOVERY_FIXTURE')).length, 100);
  const result = {
    scope: 'MEASURED synthetic local workerd, no production CPU',
    users: 5000,
    savedBets: 5000,
    gameVersions: 401,
    gameOwners: 101,
    gameHistory: {
      legacyLogicalBytes: fullSnapshotBytes,
      physicalPrimaryBytes: gameBytes,
      ratio: gameBytes / fullSnapshotBytes,
      r2Reads: gameReads,
      r2Writes: gameWrites,
    },
    worstLogicalBytes: 2100000,
    checkpoint: copied,
    repeatedCheckpoint: repeated,
    restore: restored,
    idempotentRestore: replay,
    d1Metrics: metrics,
    backupD1Metrics,
    restoreD1Metrics,
    worstObjectOperations,
    d1Pages: pages,
    r2: {
      source: source.counts,
      backup: bodyBackup.counts,
      target: target.counts,
      directoryPhysicalBytes: backupStore.bytes,
      directoryWrites: backupStore.writes,
    },
    faults: ['partial-backup', 'interrupted-restore'],
    allOriginalUserIdsPreserved: true,
  };
  await writeFile(out + 'scale-recovery.json', JSON.stringify(result, null, 2) + '\n');
  console.log(
    JSON.stringify({
      users: 5000,
      rows: copied.rows,
      objects: copied.objects,
      gameStorageRatio: gameBytes / fullSnapshotBytes,
      backupMs: copied.milliseconds,
      restoreMs: restored.milliseconds,
    }),
  );
} finally {
  await Promise.all([h.close(), b.close(), t.close()]);
}
