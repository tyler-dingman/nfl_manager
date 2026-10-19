import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, objectKey, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import {
  collectPayloadGarbage,
  storageCapacity,
} from '../../../packages/storage/garbage-collection';
import { JsonTree } from '../../../packages/storage/json-tree';
const ack = 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED' as const;
test(
  'reference-aware maintenance: nested roots, saved evidence, pins, dry run, stale writes and transactional reclamation',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase;
      const store = () => new Storage(db, new D1Objects(db));
      const s = store();
      await s
        .statement(
          "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','owner@example.invalid','ACTIVE',1,1)",
        )
        .run();
      const tree = await new JsonTree(s).put({
        original: 'active-front-office',
        state: 'original'.repeat(10000),
      });
      const envelope = await s.put({ root: tree, kind: 'FRONT_OFFICE' });
      await s
        .statement(
          "INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at) VALUES('owner','original-save','KC',2026,'REGULAR',1,?,1,1)",
          [envelope],
        )
        .run();
      const saved = await s.put({
        originalMarket: 'original-market',
        odds: -110,
        attribution: 'https://example.invalid/source',
      });
      await s
        .statement(
          "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,metadata_hash,created_at) VALUES('saved','owner','OTHER','original-bet','Evidence','{}',?,1)",
          [saved],
        )
        .run();
      const pinned = await s.put({ recovery: 'original independent checkpoint' });
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          pinned,
          'Recovery manifest',
        ])
        .run();
      const orphan = await s.put({ unpublished: 'orphan'.repeat(2000) });
      const child = await s.put({ detachedChild: true }),
        parent = await s.put({ root: child });
      const before = await storageCapacity(db);
      const preview = await collectPayloadGarbage(db, { dryRun: true, acknowledge: ack });
      assert.equal(preview.candidateObjects, 3);
      assert.equal(preview.deletedObjects, 0);
      assert.equal((await storageCapacity(db)).reservedEncodedBytes, before.reservedEncodedBytes);
      // Upload completed before GC, publication attempted after GC. Stale SDK
      // request must fail atomically rather than publish a dangling head.
      await assert.rejects(
        s
          .statement(
            "INSERT INTO app_history_packs(id,kind,object_hash,rows,created_at) VALUES('stale','TEST',?,1,1)",
            [orphan],
          )
          .run(),
      );
      const writer = store();
      const unpublished = await writer.put({ slowWriter: true });
      const swept = await collectPayloadGarbage(db, { dryRun: false, acknowledge: ack });
      assert.equal(swept.deletedObjects, 4);
      await assert.rejects(
        writer
          .statement(
            "INSERT INTO app_history_packs(id,kind,object_hash,rows,created_at) VALUES('slow','TEST',?,1,1)",
            [unpublished],
          )
          .run(),
      );
      const fresh = store();
      assert.deepEqual(await new JsonTree(fresh).get(tree), {
        original: 'active-front-office',
        state: 'original'.repeat(10000),
      });
      assert.equal((await fresh.get<any>(saved)).originalMarket, 'original-market');
      assert.equal((await fresh.get<any>(pinned)).recovery, 'original independent checkpoint');
      for (const hash of [orphan, parent, child, unpublished])
        assert.equal(await new D1Objects(db).get(objectKey(hash)), null);
      assert.equal(
        (await storageCapacity(db)).reservedEncodedBytes,
        before.reservedEncodedBytes - preview.candidateEncodedBytes,
      );
      assert.equal(
        (await collectPayloadGarbage(db, { dryRun: false, acknowledge: ack })).deletedObjects,
        0,
      );
      assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
      assert.equal((await fresh.rows('SELECT * FROM app_storage_gc_audit')).length, 4);
    } finally {
      await h.close();
    }
  },
);

test(
  'expired inference only: original expiry and active leases, corruption fails closed',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db));
      const expired = await s.put({ derived: 'expired' }),
        active = await s.put({ derived: 'active' }),
        leased = await s.put({ derived: 'pending' });
      for (const [key, hash, expiry, lease] of [
        ['expired', expired, 1, 0],
        ['active', active, Date.now() + 86400000, 0],
        ['leased', leased, 1, Date.now() + 60000],
      ] as const)
        await s
          .statement(
            'INSERT INTO app_ai_cache(cache_key,object_hash,source_version,expires_at,lease_until) VALUES(?,?,?, ?,?)',
            [key, hash, 'original-source', expiry, lease],
          )
          .run();
      const result = await collectPayloadGarbage(db, {
        dryRun: false,
        expireDerived: true,
        acknowledge: ack,
      });
      assert.equal(result.deletedObjects, 1);
      assert.equal(await new D1Objects(db).get(objectKey(expired)), null);
      assert(await new D1Objects(db).get(objectKey(active)));
      assert(await new D1Objects(db).get(objectKey(leased)));
      await db
        .prepare('UPDATE app_payload_chunks SET data=NULL,body=? WHERE hash=?')
        .bind(btoa('bad'), active)
        .run();
      await assert.rejects(collectPayloadGarbage(db, { dryRun: false, acknowledge: ack }));
      assert.equal(
        (await db.prepare('SELECT locked FROM app_storage_epoch').first<any>()).locked,
        0,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  'failed sweep rolls back chunks, capacity and audit; recovery ciphertext and abandoned fences fail closed',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db));
      const hash = await s.put({ orphan: 'must survive failed transaction' }),
        before = await storageCapacity(db);
      const failing: SqlDatabase = {
        prepare: (sql) => db.prepare(sql),
        batch: (statements) =>
          db.batch([
            ...statements,
            db.prepare("INSERT INTO app_storage_guards(id,ok) VALUES('forced-failure',0)"),
          ]),
      };
      await assert.rejects(collectPayloadGarbage(failing, { dryRun: false, acknowledge: ack }));
      assert.equal((await storageCapacity(db)).reservedEncodedBytes, before.reservedEncodedBytes);
      assert(await new D1Objects(db).get(objectKey(hash)));
      assert.equal(
        (await db.prepare('SELECT * FROM app_storage_gc_audit').all()).results.length,
        0,
      );
      const fresh = new Storage(db, new D1Objects(db));
      await fresh.put({ schema: 2, iv: 'opaque', cipher: 'independent-recovery-directory' });
      await assert.rejects(
        collectPayloadGarbage(db, { dryRun: false, acknowledge: ack }),
        /Opaque encrypted recovery/,
      );
      await db.prepare('UPDATE app_storage_epoch SET locked=1').run();
      await assert.rejects(new Storage(db, new D1Objects(db)).put({ mustNotWrite: true }));
      await assert.rejects(
        collectPayloadGarbage(db, { dryRun: false, acknowledge: ack }),
        /already locked/,
      );
      // Explicit offline owner crash recovery, never an automatic lease timeout.
      await db.prepare('UPDATE app_storage_epoch SET epoch=epoch+1,locked=0').run();
      assert(await new D1Objects(db).get(objectKey(hash)));
      await db.prepare('CREATE TABLE app_unreviewed_encoded_state(id TEXT,opaque TEXT)').run();
      await assert.rejects(
        collectPayloadGarbage(db, { dryRun: false, acknowledge: ack }),
        /Unknown root schema/,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  'legacy base64 repacking preserves hashes, IDs and reservations and resumes idempotently',
  { timeout: 120000 },
  async () => {
    const { repackLegacyPayload } = await import('../../../packages/storage/repack');
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db));
      const value = {
          originalId: 'original-editorial-id',
          text: 'historical evidence '.repeat(10000),
        },
        hash = await s.put(value);
      const before = await storageCapacity(db);
      for (const row of (
        await db
          .prepare('SELECT ordinal,data FROM app_payload_chunks WHERE hash=?')
          .bind(hash)
          .all<any>()
      ).results)
        await db
          .prepare('UPDATE app_payload_chunks SET body=?,data=NULL WHERE hash=? AND ordinal=?')
          .bind(Buffer.from(row.data).toString('base64'), hash, row.ordinal)
          .run();
      assert.deepEqual(await new Storage(db, new D1Objects(db)).get(hash), value);
      const result = await repackLegacyPayload(db, hash, ack);
      assert(result.convertedChunks > 0);
      assert.equal((await storageCapacity(db)).reservedEncodedBytes, before.reservedEncodedBytes);
      assert.deepEqual(await new Storage(db, new D1Objects(db)).get(hash), value);
      assert.equal((await repackLegacyPayload(db, hash, ack)).convertedChunks, 0);
      assert((await repackLegacyPayload(db, hash, ack, 'base64')).convertedChunks > 0);
      assert.deepEqual(await new Storage(db, new D1Objects(db)).get(hash), value);
      assert.equal(
        (
          await db
            .prepare(
              'SELECT count(*) AS n FROM app_payload_chunks WHERE hash=? AND data IS NOT NULL',
            )
            .bind(hash)
            .first<any>()
        ).n,
        0,
      );
    } finally {
      await h.close();
    }
  },
);
