import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { D1Objects, applicationObjects } from '../../../packages/storage/d1-objects';
import { Storage, digest, objectKey, utf8, type SqlDatabase } from '../../../packages/storage/core';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { D1AuthRepository } from '../../../packages/storage/auth';
test(
  'No R2: D1 payload deduplication, restart, corruption and capacity',
  { timeout: 120000 },
  async () => {
    assert.equal(process.env.DATABASE_URL, undefined);
    const h = await harness(true, true, 999, undefined, false);
    try {
      assert.deepEqual(h.options.r2Buckets, []);
      const db = h.binding as unknown as SqlDatabase,
        objects = new D1Objects(db),
        s = new Storage(db, objects);
      assert(
        await new D1AuthRepository(s).createEmailUser({
          email: 'offline@example.invalid',
          passwordHash: 'preserved-original-phc',
        }),
      );
      const payload = {
        originalId: 'original-saved-bet',
        attribution: 'https://example.invalid/original',
        history: ['original', 'corrected'],
        body: 'compressible'.repeat(100000),
      };
      const hash = await s.put(payload);
      await Promise.all(Array.from({ length: 5 }, () => s.put(payload)));
      assert.deepEqual(await s.get(hash), payload);
      assert.equal(
        (await s.rows<any>('SELECT used_bytes FROM app_payload_capacity'))[0].used_bytes,
        (await s.rows<any>('SELECT SUM(bytes) AS n FROM app_payload_objects'))[0].n,
      );
      const large = new Uint8Array(4_000_000);
      for (let i = 0; i < large.length; i += 65536)
        crypto.getRandomValues(large.subarray(i, i + 65536));
      const key = objectKey(await digest(large));
      const metrics = requestMetrics();
      await new D1Objects(instrumentDatabase(db, metrics)).putImmutable(key, large);
      assert(metrics.statements <= 35, JSON.stringify(metrics));
      console.info('maximum-payload-metrics', JSON.stringify(metrics));
      assert.deepEqual(await objects.get(key), large);
      assert.equal(
        (await s.rows('SELECT * FROM app_payload_chunks WHERE hash=?', [key.split('/').at(-1)]))
          .length,
        84,
      );
      const restarted = await h.restart(),
        nextObjects = new D1Objects(restarted as unknown as SqlDatabase);
      assert.deepEqual(
        await new Storage(restarted as unknown as SqlDatabase, nextObjects).get(hash),
        payload,
      );
      await restarted
        .prepare('UPDATE app_payload_chunks SET data=NULL,body=? WHERE hash=? AND ordinal=0')
        .bind(btoa('corrupt'), hash)
        .run();
      await assert.rejects(nextObjects.get(objectKey(hash)));
      await restarted.prepare('UPDATE app_payload_capacity SET used_bytes=64000000').run();
      const next = utf8.encode('must not lose existing data');
      await assert.rejects(
        nextObjects.putImmutable(objectKey(await digest(next)), next),
        /capacity/,
      );
      assert.equal(
        (await restarted.prepare('SELECT count(*) AS n FROM app_users').first<{ n: number }>())?.n,
        1,
      );
      assert.throws(() => applicationObjects({ APP_DB: db }), /R2 binding absent/);
    } finally {
      await h.close();
    }
  },
);
