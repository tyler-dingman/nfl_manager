import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { nativeFixture } from './fixture';
import { createWorkerBindings, NativeBoundaryError } from '../../src/server/node-staging/d1-worker';
import { BoundedD1Objects } from '../../packages/storage/bounded-d1-objects';
import { D1Objects } from '../../packages/storage/d1-objects';
import { digest, objectKey, utf8 } from '../../packages/storage/core';
import { MultiD1 } from '../../packages/storage/multi-d1';

// Real Node -> signed Web -> service binding -> private API -> native D1.
// No hosted account/database access. Wall times are NOT hosted Worker CPU.
test(
  'bounded protocol: five sizes, original SHA, compressed/raw, duplicate, native recovery format',
  { timeout: 240000 },
  async () => {
    const f = await nativeFixture();
    try {
      for (const encoding of [undefined, 'hex'] as const)
        for (const size of [4096, 8192, 16384, 32768, 65536]) {
          const bindings = createWorkerBindings({
            configuration: f.configuration,
            request: f.dispatch,
            payloadChunkBytes: size,
            payloadEncoding: encoding,
          });
          const objects = new BoundedD1Objects(bindings.D1_USERS, size, undefined, encoding);
          for (const bytes of [
            new Uint8Array(randomBytes(100003)),
            new TextEncoder().encode(
              JSON.stringify({
                size,
                encoding,
                text: 'synthetic compressible fixture '.repeat(10000),
              }),
            ),
          ]) {
            const key = objectKey(await digest(bytes));
            await objects.putImmutable(key, bytes);
            assert.deepEqual(await objects.get(key), bytes);
            const before = await bindings.D1_USERS.prepare(
              'SELECT used_bytes FROM app_payload_capacity WHERE id=1',
            ).first();
            await objects.putImmutable(key, bytes);
            assert.deepEqual(
              await bindings.D1_USERS.prepare(
                'SELECT used_bytes FROM app_payload_capacity WHERE id=1',
              ).first(),
              before,
            );
            assert.deepEqual(await new D1Objects(f.h.db.D1_USERS).get(key), bytes);
            const manifest = await bindings.D1_USERS.prepare(
              'SELECT done,offset,bytes FROM app_payload_uploads WHERE hash=?',
            )
              .bind(key.split('/').at(-1))
              .first<any>();
            if (manifest) {
              assert.equal(manifest.done, 1);
              assert.equal(manifest.offset, manifest.bytes);
            } else {
              const inline = await bindings.D1_USERS.prepare(
                'SELECT bytes,complete,inline_data IS NOT NULL AS inline FROM app_payload_objects WHERE hash=?',
              )
                .bind(key.split('/').at(-1))
                .first<any>();
              assert.equal(inline.complete, 1);
              assert.equal(inline.inline, 1);
              assert(inline.bytes <= 4096);
            }
          }
        }
      const bindings = createWorkerBindings({
        configuration: f.configuration,
        request: f.dispatch,
        payloadChunkBytes: 4096,
      });
      const router = new MultiD1(bindings);
      const value = { text: randomBytes(120000).toString('base64') };
      const hash = await router.users().put(value);
      assert.deepEqual(await router.users().get(hash), value);
      assert((router.metrics.payloadStatements ?? 0) > 50);
      assert(router.metrics.statements - (router.metrics.payloadStatements ?? 0) < 50);
    } finally {
      await f.close();
    }
  },
);

test(
  'lost response: durable progress, explicit restart resume, no automatic retry; stale fences',
  { timeout: 180000 },
  async () => {
    const f = await nativeFixture();
    try {
      const bytes = new Uint8Array(randomBytes(110003)),
        key = objectKey(await digest(bytes));
      let lost = false,
        mutations = 0;
      const bindings = createWorkerBindings({
        configuration: f.configuration,
        payloadChunkBytes: 4096,
        request: async (input, init) => {
          const req = input instanceof Request ? input : new Request(input, init);
          const command = await req.clone().json();
          const part = command.queries.some((q: any) =>
            q.sql.startsWith('INSERT INTO app_payload_upload_parts'),
          );
          const response = await f.dispatch(req);
          if (part) {
            mutations++;
            if (!lost) {
              lost = true;
              throw Error('synthetic lost HTTP response after durable native batch');
            }
          }
          return response;
        },
      });
      const old = new BoundedD1Objects(bindings.D1_USERS, 4096);
      await assert.rejects(old.putImmutable(key, bytes), NativeBoundaryError);
      assert.equal(mutations, 1);
      assert.equal(await old.get(key), null);
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare('SELECT offset FROM app_payload_uploads WHERE hash=?')
            .bind(key.split('/').at(-1))
            .first<any>()
        )?.offset,
        4096,
      );
      await f.restart();
      // A resumed server gets a fresh fence; an old captured writer cannot publish.
      await f.h.db.D1_USERS.prepare('UPDATE app_storage_epoch SET epoch=epoch+1 WHERE id=1').run();
      await assert.rejects(old.putImmutable(key, bytes));
      const fresh = new BoundedD1Objects(
        createWorkerBindings({ configuration: f.configuration, request: f.dispatch }).D1_USERS,
        4096,
      );
      await fresh.putImmutable(key, bytes);
      assert.deepEqual(await fresh.get(key), bytes);
      await assert.rejects(
        f.h.db.D1_USERS.prepare('UPDATE app_payload_chunks SET data=? WHERE hash=? AND ordinal=0')
          .bind(new Uint8Array([1]).buffer, key.split('/').at(-1))
          .run(),
      );
    } finally {
      await f.close();
    }
  },
);

test(
  'atomic append rollback, corrupt manifest/receipt, missing chunk, concurrent finalization',
  { timeout: 180000 },
  async () => {
    const f = await nativeFixture();
    try {
      const bytes = new Uint8Array(randomBytes(17003)),
        hash = await digest(bytes),
        key = objectKey(hash);
      let stop = true;
      const broken = createWorkerBindings({
        configuration: f.configuration,
        payloadChunkBytes: 4096,
        request: async (input, init) => {
          const req = input instanceof Request ? input : new Request(input, init);
          const command = await req.clone().json();
          if (
            stop &&
            command.queries.some((q: any) =>
              q.sql.startsWith('INSERT INTO app_payload_upload_parts'),
            )
          ) {
            stop = false;
            throw Error('crash before chunk dispatch');
          }
          return f.dispatch(req);
        },
      });
      await assert.rejects(new BoundedD1Objects(broken.D1_USERS, 4096).putImmutable(key, bytes));
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare('SELECT offset FROM app_payload_uploads WHERE hash=?')
            .bind(hash)
            .first<any>()
        ).offset,
        0,
      );
      assert.equal(
        await f.h.db.D1_USERS.prepare('SELECT * FROM app_payload_chunks WHERE hash=?')
          .bind(hash)
          .first(),
        null,
      );
      // Corruption cannot be accepted as completed; identity and receipt mutation fail.
      await assert.rejects(
        f.h.db.D1_USERS.prepare('UPDATE app_payload_uploads SET encoded_hash=? WHERE hash=?')
          .bind('0'.repeat(64), hash)
          .run(),
      );
      await assert.rejects(
        f.h.db.D1_USERS.prepare('UPDATE app_payload_objects SET complete=1 WHERE hash=?')
          .bind(hash)
          .run(),
      );
      const make = () => new BoundedD1Objects(f.bindings.D1_USERS, 4096);
      await make().putImmutable(key, bytes);
      const concurrent = await Promise.allSettled([
        make().putImmutable(key, bytes),
        make().putImmutable(key, bytes),
      ]);
      assert(concurrent.every((r) => r.status === 'fulfilled'));
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare(
            'SELECT count(*) n FROM app_payload_uploads WHERE hash=? AND done=1',
          )
            .bind(hash)
            .first<any>()
        ).n,
        1,
      );
      // Simulated corruption during locked owner maintenance: never return partial bytes.
      await f.h.db.D1_USERS.prepare('UPDATE app_storage_epoch SET locked=1 WHERE id=1').run();
      await f.h.db.D1_USERS.prepare('DELETE FROM app_payload_chunks WHERE hash=?').bind(hash).run();
      await f.h.db.D1_USERS.prepare(
        'UPDATE app_storage_epoch SET locked=0,epoch=epoch+1 WHERE id=1',
      ).run();
      await assert.rejects(make().get(key));
    } finally {
      await f.close();
    }
  },
);

test(
  'native D1 supports binary SQL conversion without numeric-array binding',
  { timeout: 60000 },
  async () => {
    const f = await nativeFixture();
    try {
      assert.deepEqual(
        await f.bindings.D1_USERS.prepare('SELECT hex(unhex(?)) AS binary')
          .bind('00ff807f')
          .first(),
        { binary: '00FF807F' },
      );
    } finally {
      await f.close();
    }
  },
);

test(
  'encrypted coordinated backup restores completed and interrupted uploads without altering original hashes',
  { timeout: 180000 },
  async () => {
    const { backupDatabases, restoreDatabases } = await import('../../scripts/multi-d1-recovery');
    const { sealErasureLedger } = await import('../../scripts/erasure-ledger');
    const { splitSql } = await import('../../packages/storage/sql-script');
    const { verifyCrossShardReferences } = await import('../../packages/storage/cross-shard-saves');
    const f = await nativeFixture(),
      target = await nativeFixture(false);
    try {
      const secret = 'synthetic-bounded-offline-encryption-key-at-least-64-characters-only';
      const bytes = new TextEncoder().encode(
          JSON.stringify({ fixture: randomBytes(70000).toString('base64') }),
        ),
        key = objectKey(await digest(bytes));
      await new BoundedD1Objects(f.bindings.D1_USERS, 4096).putImmutable(key, bytes);
      const pending = new Uint8Array(randomBytes(9003)),
        pendingKey = objectKey(await digest(pending));
      let interrupted = false;
      const fail = createWorkerBindings({
        configuration: f.configuration,
        request: async (input, init) => {
          const req = input instanceof Request ? input : new Request(input, init);
          const q = await req.clone().json();
          const response = await f.dispatch(req);
          if (
            !interrupted &&
            q.queries.some((x: any) => x.sql.startsWith('INSERT INTO app_payload_upload_parts'))
          ) {
            interrupted = true;
            throw Error('interrupted before offline snapshot');
          }
          return response;
        },
      });
      await assert.rejects(
        new BoundedD1Objects(fail.D1_USERS, 4096).putImmutable(pendingKey, pending),
      );
      const archive = await backupDatabases(f.h.db, secret, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      const ledger = await sealErasureLedger(f.h.db.D1_USERS, secret);
      await restoreDatabases(archive, secret, target.h.db, {
        currentErasureLedger: ledger,
        isolatedEmptyTargets: true,
        verifyReferences: verifyCrossShardReferences,
        execute: async (owner, sql) => {
          for (const statement of splitSql(sql)) await target.h.db[owner].prepare(statement).run();
        },
      });
      const restored = new BoundedD1Objects(target.bindings.D1_USERS, 4096);
      assert.deepEqual(await restored.get(key), bytes);
      assert.equal(await restored.get(pendingKey), null);
      await restored.putImmutable(pendingKey, pending);
      assert.deepEqual(await restored.get(pendingKey), pending);
    } finally {
      await target.close();
      await f.close();
    }
  },
);

test(
  'native publication guards and shared maintenance epoch reject incomplete and stale business heads',
  { timeout: 90000 },
  async () => {
    const f = await nativeFixture();
    try {
      const bytes = new Uint8Array(randomBytes(9003)),
        hash = await digest(bytes),
        key = objectKey(hash);
      let fail = true;
      const bindings = createWorkerBindings({
        configuration: f.configuration,
        payloadChunkBytes: 4096,
        request: async (input, init) => {
          const req = input instanceof Request ? input : new Request(input, init);
          const q = await req.clone().json();
          if (
            fail &&
            q.queries.some((x: any) => x.sql.startsWith('INSERT INTO app_payload_upload_parts'))
          ) {
            fail = false;
            throw Error('pre-dispatch interruption');
          }
          return f.dispatch(req);
        },
      });
      const objects = new BoundedD1Objects(bindings.D1_USERS, 4096, bindings.D1_USERS);
      await assert.rejects(objects.putImmutable(key, bytes));
      // Trigger runs before ownership/FK checks: no incomplete hash may become a head.
      await assert.rejects(
        f.h.db.D1_USERS.prepare(
          'INSERT INTO app_heads(owner_id,kind,id,revision,object_hash,updated_at) VALUES(?,?,?,?,?,?)',
        )
          .bind('missing-user', 'test', 'pending', 1, hash, 0)
          .run(),
        /Unpublished payload reference/,
      );
      await new BoundedD1Objects(f.bindings.D1_USERS, 4096).putImmutable(key, bytes);
      await f.h.db.D1_USERS.prepare('UPDATE app_storage_epoch SET epoch=epoch+1 WHERE id=1').run();
      const business = objects.transactionDatabase(bindings.D1_USERS);
      await assert.rejects(
        business.prepare('UPDATE app_payload_capacity SET used_bytes=used_bytes WHERE id=1').run(),
        /write epoch/,
      );
    } finally {
      await f.close();
    }
  },
);

test(
  'owner maintenance collects abandoned uploads with capacity/receipt integrity and fences stale publishers',
  { timeout: 90000 },
  async () => {
    const { collectPayloadGarbage } = await import('../../packages/storage/garbage-collection');
    const f = await nativeFixture();
    try {
      const bindings = createWorkerBindings({
        configuration: f.configuration,
        request: f.dispatch,
        payloadChunkBytes: 4096,
        payloadEncoding: 'hex',
      });
      const objects = new BoundedD1Objects(bindings.D1_USERS, 4096, undefined, 'hex');
      for (const value of [
        { tiny: 'synthetic orphan' },
        { large: randomBytes(30000).toString('base64') },
      ]) {
        const bytes = utf8.encode(JSON.stringify(value));
        await objects.putImmutable(objectKey(await digest(bytes)), bytes);
      }
      const pending = utf8.encode(
        JSON.stringify({ pending: randomBytes(12000).toString('base64') }),
      );
      let crashed = false;
      const broken = createWorkerBindings({
        configuration: f.configuration,
        request: async (input, init) => {
          const req = input instanceof Request ? input : new Request(input, init),
            q = await req.clone().json();
          if (
            !crashed &&
            q.queries.some((s: any) => s.sql.startsWith('INSERT INTO app_payload_upload_parts'))
          ) {
            crashed = true;
            throw Error('synthetic interrupted upload');
          }
          return f.dispatch(req);
        },
      });
      await assert.rejects(
        new BoundedD1Objects(broken.D1_USERS, 4096).putImmutable(
          objectKey(await digest(pending)),
          pending,
        ),
      );
      const result = await collectPayloadGarbage(f.h.db.D1_USERS, {
        dryRun: false,
        limit: 10,
        role: 'users',
        acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
      });
      assert.equal(result.deletedObjects, 3);
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare(
            'SELECT used_bytes FROM app_payload_capacity WHERE id=1',
          ).first<any>()
        ).used_bytes,
        0,
      );
      assert.equal(
        (await f.h.db.D1_USERS.prepare('SELECT count(*) n FROM app_payload_uploads').first<any>())
          .n,
        0,
      );
      assert.equal(
        (await f.h.db.D1_USERS.prepare('PRAGMA foreign_key_check').all()).results.length,
        0,
      );
      const next = utf8.encode(JSON.stringify({ stale: 'must reject' }));
      await assert.rejects(objects.putImmutable(objectKey(await digest(next)), next));
    } finally {
      await f.close();
    }
  },
);

test(
  'cross-shard references honor target ownership when a local copy is unfinished',
  { timeout: 90000 },
  async () => {
    const { D1AuthRepository } = await import('../../packages/storage/auth');
    const f = await nativeFixture();
    try {
      const bytes = utf8.encode(
          JSON.stringify({ crossShard: randomBytes(9000).toString('base64') }),
        ),
        hash = await digest(bytes),
        key = objectKey(hash);
      await new BoundedD1Objects(f.bindings.D1_TEAM_1, 4096).putImmutable(key, bytes);
      const user = await new D1AuthRepository(new MultiD1(f.bindings).users()).createEmailUser({
        email: 'guard-owner@example.invalid',
        passwordHash: 'isolated-rollback-only',
      });
      assert(user);
      let failed = false;
      const interrupted = createWorkerBindings({
        configuration: f.configuration,
        request: async (input, init) => {
          const r = input instanceof Request ? input : new Request(input, init),
            q = await r.clone().json();
          if (
            !failed &&
            q.queries.some((x: any) => x.sql.startsWith('INSERT INTO app_payload_upload_parts'))
          ) {
            failed = true;
            throw Error('synthetic unfinished local copy');
          }
          return f.dispatch(r);
        },
      });
      await assert.rejects(
        new BoundedD1Objects(interrupted.D1_USERS, 4096).putImmutable(key, bytes),
      );
      await f.bindings.D1_USERS.prepare(
        'INSERT INTO app_cross_shard_references(user_id,kind,content_id,owner,object_hash,state,updated_at) VALUES(?,?,?,?,?,?,?)',
      )
        .bind(user.id, 'STORY', 'foreign-target', 'D1_TEAM_1', hash, 'COMMITTED', Date.now())
        .run();
      await assert.rejects(
        f.bindings.D1_USERS.prepare(
          'INSERT INTO app_cross_shard_references(user_id,kind,content_id,owner,object_hash,state,updated_at) VALUES(?,?,?,?,?,?,?)',
        )
          .bind(
            user.id,
            'STORY',
            'unfinished-local-target',
            'D1_USERS',
            hash,
            'COMMITTED',
            Date.now(),
          )
          .run(),
      );
      assert.deepEqual(await new BoundedD1Objects(f.bindings.D1_TEAM_1, 4096).get(key), bytes);
    } finally {
      await f.close();
    }
  },
);

test(
  'concurrent native finalization publishes one immutable identity and receipt inventory',
  { timeout: 90000 },
  async () => {
    const f = await nativeFixture();
    try {
      const bytes = new Uint8Array(randomBytes(17003)),
        hash = await digest(bytes),
        key = objectKey(hash);
      const stopBeforeFinalize = createWorkerBindings({
        configuration: f.configuration,
        request: async (input, init) => {
          const r = input instanceof Request ? input : new Request(input, init),
            q = await r.clone().json();
          if (
            q.queries.some((s: any) =>
              s.sql.startsWith('UPDATE app_payload_objects SET complete=1'),
            )
          )
            throw Error('synthetic crash before finalize dispatch');
          return f.dispatch(r);
        },
      });
      await assert.rejects(
        new BoundedD1Objects(stopBeforeFinalize.D1_USERS, 4096).putImmutable(key, bytes),
      );
      assert.equal(await new BoundedD1Objects(f.bindings.D1_USERS, 4096).get(key), null);
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const make = () =>
        new BoundedD1Objects(
          createWorkerBindings({
            configuration: f.configuration,
            request: async (input, init) => {
              const r = input instanceof Request ? input : new Request(input, init),
                q = await r.clone().json();
              if (
                q.queries.some((s: any) =>
                  s.sql.startsWith('UPDATE app_payload_objects SET complete=1'),
                )
              ) {
                arrivals++;
                if (arrivals === 2) release();
                await barrier;
              }
              return f.dispatch(r);
            },
          }).D1_USERS,
          4096,
        );
      await Promise.all([make().putImmutable(key, bytes), make().putImmutable(key, bytes)]);
      assert.equal(arrivals, 2);
      const [manifest] = await f.h.db.D1_USERS.prepare(
        'SELECT done,offset,bytes FROM app_payload_uploads WHERE hash=?',
      )
        .bind(hash)
        .all<any>()
        .then((r) => r.results);
      assert.equal(manifest.done, 1);
      assert.equal(manifest.offset, bytes.length);
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare(
            'SELECT count(*) n FROM app_payload_upload_parts WHERE hash=?',
          )
            .bind(hash)
            .first<any>()
        ).n,
        Math.ceil(bytes.length / 4096),
      );
      assert.deepEqual(await new BoundedD1Objects(f.bindings.D1_USERS, 4096).get(key), bytes);
    } finally {
      await f.close();
    }
  },
);

test(
  'authenticated out-of-order chunk batch rolls back without partial progress',
  { timeout: 90000 },
  async () => {
    const { signOriginRequest, ORIGIN_HEADER } =
      await import('../../packages/security/origin-assertion');
    const f = await nativeFixture();
    try {
      const bytes = new Uint8Array(randomBytes(9003)),
        hash = await digest(bytes);
      let changed = false;
      const bindings = createWorkerBindings({
        configuration: f.configuration,
        request: async (input, init) => {
          const r = input instanceof Request ? input : new Request(input, init),
            q = await r.clone().json();
          const guard = q.queries.find((s: any) =>
            s.sql.includes('offset=? AND done=0 AND bytes=?'),
          );
          if (!changed && guard) {
            changed = true;
            guard.params[2] = 4096;
            const altered = new Request(r.url, { method: 'POST', body: JSON.stringify(q) }),
              signed = await signOriginRequest(altered, f.configuration);
            const response = await f.dispatch(
              new Request(r.url, {
                method: 'POST',
                headers: { [ORIGIN_HEADER]: signed.assertion },
                body: signed.body as BodyInit,
              }),
            );
            assert.equal(
              response.status,
              409,
              'valid origin authentication must reach the native progress guard',
            );
            return response;
          }
          return f.dispatch(r);
        },
      });
      await assert.rejects(
        new BoundedD1Objects(bindings.D1_USERS, 4096).putImmutable(objectKey(hash), bytes),
      );
      assert(changed);
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare('SELECT offset,done FROM app_payload_uploads WHERE hash=?')
            .bind(hash)
            .first<any>()
        ).offset,
        0,
      );
      assert.equal(
        (
          await f.h.db.D1_USERS.prepare('SELECT count(*) n FROM app_payload_chunks WHERE hash=?')
            .bind(hash)
            .first<any>()
        ).n,
        0,
      );
    } finally {
      await f.close();
    }
  },
);
