import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import {
  incrementalCheckpoint,
  restoreIncremental,
  materializePoint,
  planRecoveryRetention,
  pruneRecoveryDirectories,
} from '../../../packages/storage/incremental-recovery';
import { unsealDirectory } from '../../../packages/storage/backup-codec';
const secret = 'synthetic-backup-secret-at-least-32-characters';
function raw(bucket: any) {
  return {
    keys: async () => {
      const keys: string[] = [];
      let cursor;
      do {
        const p = await bucket.list({ cursor });
        keys.push(...p.objects.map((o: any) => o.key));
        cursor = p.truncated ? p.cursor : undefined;
      } while (cursor);
      return keys;
    },
    get: async (k: string) => {
      const v = await bucket.get(k);
      return v ? new Uint8Array(await v.arrayBuffer()) : null;
    },
    putImmutable: async (k: string, bytes: Uint8Array) => {
      const old = await bucket.get(k);
      if (old) assert.deepEqual(new Uint8Array(await old.arrayBuffer()), bytes);
      else await bucket.put(k, bytes);
    },
  };
}
test(
  'weekly full + daily row deltas: complete chain restore, interrupted restore, missing/corrupt parent rejection and reference-safe retention',
  { timeout: 120000 },
  async () => {
    const h = await harness(),
      b = await harness(),
      t = await harness();
    try {
      const sourceBucket = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
        directoryBucket = await b.mf.getR2Bucket('EDITORIAL_BACKUP'),
        bodyBucket = await b.mf.getR2Bucket('EDITORIAL_ARCHIVE');
      const s = new Storage(
          h.binding as unknown as SqlDatabase,
          new PrivateObjects(sourceBucket as unknown as Bucket),
        ),
        backup = new Storage(
          b.binding as unknown as SqlDatabase,
          new PrivateObjects(directoryBucket as unknown as Bucket),
        );
      for (let i = 0; i < 50; i++)
        await s.batch([
          s.statement(
            "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES(?,?,'ACTIVE',1,1)",
            ['original-user-' + i, `user-${i}@example.invalid`],
          ),
          s.statement(
            'INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES(?,?,1)',
            ['original-user-' + i, JSON.stringify({ team: 'KC', original: true })],
          ),
        ]);
      for (let i = 0; i < 20; i++)
        await s.put({ id: 'original-archive-' + i, body: 'Retained original source'.repeat(100) });
      const points: any[] = [];
      let id: string | undefined;
      const now = Date.parse('2026-10-01T00:00:00Z');
      for (let day = 0; day < 15; day++) {
        if (day)
          await s
            .statement('UPDATE app_settings SET preferences_json=? WHERE user_id=?', [
              JSON.stringify({ team: day % 2 ? 'KC' : 'SEA', day }),
              'original-user-0',
            ])
            .run();
        const p = await incrementalCheckpoint(
          s.db,
          raw(sourceBucket),
          backup,
          raw(bodyBucket),
          secret,
          'OFFLINE_WRITERS_STOPPED',
          id,
          now + day * 86400000,
        );
        if (day % 7 === 0) assert.equal(p.kind, 'WEEKLY_FULL');
        else {
          assert.equal(p.kind, 'DAILY_DELTA');
          assert.equal(p.changedRows, 2);
        }
        id = p.id;
        points.push({ id, createdAt: now + day * 86400000 });
      }
      const target = raw(await t.mf.getR2Bucket('EDITORIAL_ARCHIVE'));
      let chunks = 0;
      await assert.rejects(
        restoreIncremental(
          t.binding as unknown as SqlDatabase,
          target,
          backup,
          raw(bodyBucket),
          secret,
          points[13].id,
          'OFFLINE_WRITERS_STOPPED',
          () => {
            if (++chunks === 3) throw Error('Injected interruption');
          },
        ),
        /Injected/,
      );
      await restoreIncremental(
        t.binding as unknown as SqlDatabase,
        target,
        backup,
        raw(bodyBucket),
        secret,
        points[13].id,
        'OFFLINE_WRITERS_STOPPED',
      );
      const row = await t.binding
        .prepare('SELECT preferences_json FROM app_settings WHERE user_id=?')
        .bind('original-user-0')
        .first<any>();
      assert.equal(JSON.parse(row.preferences_json).day, 13);
      assert.equal((await t.binding.prepare('SELECT * FROM app_users').all()).results.length, 50);
      assert.equal((await t.binding.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
      const p = await unsealDirectory<any>(await backup.get(points[13].id), secret),
        key = 'application/v1/' + p.patches[0],
        saved = await directoryBucket.get(key),
        bytes = await saved!.arrayBuffer();
      await directoryBucket.delete(key);
      await assert.rejects(materializePoint(backup, points[13].id, secret));
      await directoryBucket.put(key, bytes);
    const corrupt=new Uint8Array(bytes.slice(0));corrupt[corrupt.length-1]^=1;
    await directoryBucket.put(key,corrupt);await assert.rejects(materializePoint(backup,points[13].id,secret));await directoryBucket.put(key,bytes);

      const plan = await planRecoveryRetention(backup, points, secret, now + 15 * 86400000, 7);
      assert(plan.keep.includes(points[7].id), 'Retained deltas require their weekly base');
      assert(!plan.keep.includes(points[0].id));
      const payloadKeys = await raw(bodyBucket).keys();
      let purged = 0;
      await assert.rejects(
        pruneRecoveryDirectories(
          backup,
          points,
          secret,
          async (h) => {
            await directoryBucket.delete('application/v1/' + h);
            if (++purged === 2) throw Error('Interrupted directory purge');
          },
          'OFFLINE_BACKUP_WRITERS_STOPPED',
          now + 15 * 86400000,
          7,
        ),
        /Interrupted directory purge/,
      );
      const pruned = await pruneRecoveryDirectories(
        backup,
        points,
        secret,
        (h) => directoryBucket.delete('application/v1/' + h),
        'OFFLINE_BACKUP_WRITERS_STOPPED',
        now + 15 * 86400000,
        7,
      );
      assert(pruned.deletedDirectoryRecords > 0);
      assert.deepEqual(await raw(bodyBucket).keys(), payloadKeys);
      assert((await materializePoint(backup, points[13].id, secret)).tables.length > 0);
      await assert.rejects(materializePoint(backup, points[0].id, secret));
    } finally {
      await Promise.all([h.close(), b.close(), t.close()]);
    }
  },
);
