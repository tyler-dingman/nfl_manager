import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFixture } from './fixture';
import { D1AuthRepository } from '../../packages/storage/auth';
import { MultiD1 } from '../../packages/storage/multi-d1';
import { digest, utf8 } from '../../packages/storage/core';

test(
  'post-provider authorization snapshot rejects concurrent logout, erasure, tombstones and changed bindings',
  { timeout: 90000 },
  async () => {
    const f = await nativeFixture();
    try {
      const repo = () => new D1AuthRepository(new MultiD1(f.bindings).users());
      const a = await repo().createEmailUser({
          email: 'coalesced-a@example.invalid',
          passwordHash: 'synthetic-rollback-only',
        }),
        b = await repo().createEmailUser({
          email: 'coalesced-b@example.invalid',
          passwordHash: 'synthetic-rollback-only',
        });
      assert(a && b);
      const identityHash = 'a'.repeat(64),
        subject = 'synthetic-project:owner',
        cipher = 'synthetic-encrypted-token-placeholder',
        token = 'synthetic-coalesced-refresh';
      await f.h.db.D1_USERS.prepare(
        "INSERT INTO app_identities(id,user_id,provider,provider_subject,created_at) VALUES(?,?,'FIREBASE',?,?)",
      )
        .bind('synthetic-firebase-identity', a.id, subject, Date.now())
        .run();
      const session = await repo().createSession({
        userId: a.id,
        token,
        firebase: { identityHash, idTokenCiphertext: cipher },
      });
      const input = {
        sessionId: session.id,
        userId: a.id,
        identityHash,
        providerSubject: subject,
        authTime: Math.floor(Date.now() / 1000),
        ciphertext: cipher,
      };
      assert.equal(
        (await repo().firebaseSessionContext({ tokenHash: await digest(utf8.encode(token)) }))
          ?.user_id,
        a.id,
      );
      assert.equal((await repo().verifiedFirebaseSessionUser(input))?.id, a.id);
      assert.equal(
        await repo().firebaseSessionContext({ sessionId: session.id, userId: b.id }),
        null,
      );
      assert.equal(await repo().verifiedFirebaseSessionUser({ ...input, userId: b.id }), null);
      assert.equal(
        await repo().verifiedFirebaseSessionUser({ ...input, identityHash: 'b'.repeat(64) }),
        null,
      );
      assert.equal(
        await repo().verifiedFirebaseSessionUser({
          ...input,
          providerSubject: 'synthetic-project:foreign',
        }),
        null,
      );
      assert.equal(
        await repo().verifiedFirebaseSessionUser({ ...input, ciphertext: 'changed' }),
        null,
      );
      // Initial context was already read; revocation while a live provider call is in
      // flight must still be rejected by the final DB snapshot.
      await f.h.db.D1_USERS.prepare('UPDATE app_sessions SET revoked_at=? WHERE id=?')
        .bind(Date.now(), session.id)
        .run();
      assert.equal(await repo().verifiedFirebaseSessionUser(input), null);
      await f.h.db.D1_USERS.prepare(
        'UPDATE app_sessions SET revoked_at=NULL,expires_at=? WHERE id=?',
      )
        .bind(Date.now() - 1, session.id)
        .run();
      assert.equal(await repo().verifiedFirebaseSessionUser(input), null);
      await f.h.db.D1_USERS.prepare('UPDATE app_sessions SET expires_at=? WHERE id=?')
        .bind(Date.now() + 60000, session.id)
        .run();
      await f.h.db.D1_USERS.prepare("UPDATE app_users SET status='DELETED' WHERE id=?")
        .bind(a.id)
        .run();
      assert.equal(await repo().verifiedFirebaseSessionUser(input), null);
      await f.h.db.D1_USERS.prepare("UPDATE app_users SET status='ACTIVE' WHERE id=?")
        .bind(a.id)
        .run();
      await f.h.db.D1_USERS.prepare(
        'INSERT INTO app_firebase_revocations(identity_hash,revoked_before) VALUES(?,?)',
      )
        .bind(identityHash, input.authTime)
        .run();
      assert.equal(await repo().verifiedFirebaseSessionUser(input), null);
      await f.h.db.D1_USERS.prepare(
        'UPDATE app_firebase_revocations SET revoked_before=0,deleted=1 WHERE identity_hash=?',
      )
        .bind(identityHash)
        .run();
      assert.equal(await repo().verifiedFirebaseSessionUser(input), null);
    } finally {
      await f.close();
    }
  },
);

test(
  'guarded nonce insert preserves replay, maintenance and atomic cleanup failures',
  { timeout: 90000 },
  async () => {
    const { claimOriginNonce } = await import('../../src/server/node-staging/replay');
    const f = await nativeFixture();
    try {
      const db = f.h.db.D1_USERS,
        expires = Math.floor(Date.now() / 1000) + 20;
      const nonce = () => crypto.randomUUID().replaceAll('-', '');
      const plan = await db
        .prepare(
          'EXPLAIN QUERY PLAN SELECT nonce FROM app_assertions WHERE nonce>=? AND nonce<? ORDER BY nonce LIMIT 64',
        )
        .bind('origin:v1:', `origin:v1:${Math.floor(Date.now() / 1000)}:`)
        .all<any>();
      assert(
        plan.results.some((r) => /SEARCH.*INDEX/i.test(r.detail)),
        'nonce expiration must use indexed bounds',
      );
      const a = nonce();
      await claimOriginNonce(db, a, expires);
      await assert.rejects(claimOriginNonce(db, a, expires));
      await db.prepare('UPDATE app_storage_epoch SET locked=1 WHERE id=1').run();
      const locked = nonce();
      await assert.rejects(claimOriginNonce(db, locked, expires));
      assert.equal(
        await db
          .prepare('SELECT nonce FROM app_assertions WHERE nonce=?')
          .bind(`origin:v1:${expires}:${locked}`)
          .first(),
        null,
      );
      await db.prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1').run();
      const rolled = nonce();
      const broken = {
        prepare: db.prepare.bind(db),
        batch: (statements: any[]) =>
          db.batch([
            ...statements,
            db
              .prepare('INSERT INTO app_assertions(nonce,ok) VALUES(?,0)')
              .bind('synthetic-rollback-check'),
          ]),
      };
      await assert.rejects(claimOriginNonce(broken, rolled, expires));
      assert.equal(
        await db
          .prepare('SELECT nonce FROM app_assertions WHERE nonce=?')
          .bind(`origin:v1:${expires}:${rolled}`)
          .first(),
        null,
      );
      await db.prepare('DELETE FROM app_storage_epoch WHERE id=1').run();
      const missing = nonce();
      await assert.rejects(claimOriginNonce(db, missing, expires));
      assert.equal(
        await db
          .prepare('SELECT nonce FROM app_assertions WHERE nonce=?')
          .bind(`origin:v1:${expires}:${missing}`)
          .first(),
        null,
      );
    } finally {
      await f.close();
    }
  },
);
