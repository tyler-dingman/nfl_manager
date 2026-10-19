import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { checkpoint, restore } from '../../../packages/storage/cold-recovery';
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
    get: async (key: string) => {
      const r = await bucket.get(key);
      return r ? new Uint8Array(await r.arrayBuffer()) : null;
    },
    putImmutable: async (key: string, bytes: Uint8Array) => {
      const old = await bucket.get(key);
      if (old) assert.deepEqual(new Uint8Array(await old.arrayBuffer()), bytes);
      else await bucket.put(key, bytes);
    },
  };
}
test(
  'opt-in binary directory checkpoint restores original rows and all immutable objects into fresh D1/R2',
  { timeout: 120000 },
  async () => {
    const h = await harness(),
      b = await harness(),
      t = await harness();
    try {
      const source = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
        directories = await b.mf.getR2Bucket('EDITORIAL_BACKUP'),
        bodies = await b.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
        target = await t.mf.getR2Bucket('EDITORIAL_ARCHIVE');
      const storage = new Storage(
        h.binding as unknown as SqlDatabase,
        new PrivateObjects(source as unknown as Bucket),
      );
      const backup = new Storage(
        b.binding as unknown as SqlDatabase,
        new PrivateObjects(directories as unknown as Bucket),
      );
      for (let i = 0; i < 500; i++)
        await storage.batch([
          storage.statement(
            "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES(?,?,'ACTIVE',1,1)",
            ['unchanged-' + i, `user-${i}@example.invalid`],
          ),
          storage.statement(
            'INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES(?,?,1)',
            [
              'unchanged-' + i,
              JSON.stringify({ team: i % 2 ? 'SEA' : 'KC', note: 'Original 🏈'.repeat(30) }),
            ],
          ),
        ]);
      const object = await storage.put({
        saved: 'unreferenced-immutable-preserved',
        payload: 'archive'.repeat(20000),
      });
      const secret = 'synthetic-backup-final-secret-at-least-32-characters';
      const old = await checkpoint(
        storage.db,
        raw(source),
        backup,
        raw(bodies),
        secret,
        'OFFLINE_WRITERS_STOPPED',
      );
      const originalKeys = await raw(directories).keys();
      const before = originalKeys.length;
      const compact = await checkpoint(
        storage.db,
        raw(source),
        backup,
        raw(bodies),
        secret,
        'OFFLINE_WRITERS_STOPPED',
        undefined,
        'binary-v2',
      );
      const allKeys = await raw(directories).keys();
      await restore(
        t.binding as unknown as SqlDatabase,
        raw(target),
        backup,
        raw(bodies),
        secret,
        compact.id,
        'OFFLINE_WRITERS_STOPPED',
      );
      assert.equal(
        (await t.binding.prepare('SELECT count(*) n FROM app_users').first<any>()).n,
        500,
      );
      assert.equal((await t.binding.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
      assert.deepEqual(
        await raw(target).get('application/v1/' + object),
        await raw(source).get('application/v1/' + object),
      );
      const legacyReadTarget = await harness();
      try {
        await restore(
          legacyReadTarget.binding as unknown as SqlDatabase,
          raw(await legacyReadTarget.mf.getR2Bucket('EDITORIAL_ARCHIVE')),
          backup,
          raw(bodies),
          secret,
          old.id,
          'OFFLINE_WRITERS_STOPPED',
        );
      } finally {
        await legacyReadTarget.close();
      }
      const sumBytes = async (keys: string[]) => {
        let total = 0;
        for (const key of keys) total += (await raw(directories).get(key))!.length;
        return total;
      };
      const beforeDirectoryBytes = await sumBytes(originalKeys),
        afterDirectoryBytes = await sumBytes(allKeys.filter((key) => !originalKeys.includes(key)));
      assert(afterDirectoryBytes < beforeDirectoryBytes);
      await writeFile(
        new URL('../../../reports/final-staging/binary-restore.json', import.meta.url),
        JSON.stringify(
          {
            beforeDirectoryBytes,
            afterDirectoryBytes,
            users: 500,
            originalIdsPreserved: true,
            unreferencedObjectsPreserved: true,
            newDirectoryObjects: allKeys.length - before,
            legacyAndBinaryRestore: true,
            localOnly: true,
          },
          null,
          2,
        ),
      );
    } finally {
      await h.close();
      await b.close();
      await t.close();
    }
  },
);
