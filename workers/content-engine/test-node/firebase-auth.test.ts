import { withAuthTimings, type AuthTiming } from '../../../src/server/auth/performance';
import {
  sealFirebaseLedger,
  openFirebaseLedger,
  replayFirebaseLedger,
} from '../../../scripts/firebase-auth-ledger';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { multiHarness } from '../test/multi-harness';
import { requestMetrics } from '../../../packages/storage/instrumentation';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import {
  exchangeFirebaseSession,
  deleteFirebaseIdentity,
  resumeFirebaseErasures,
  revokeFirebaseUserSessions,
} from '../../../src/server/auth/firebase-service';
import {
  userFromAccessToken,
  userFromSessionToken,
  issueSession,
} from '../../../src/server/auth/service';
import { hashPassword } from '../../../src/server/auth/crypto';
import { POST as legacyLogin } from '../../../src/app/api/auth/login/route';
import { NextRequest } from 'next/server';
const project = 'synthetic-firebase-fixture';
test(
  'Firebase D1 lifecycle preserves UUIDs, isolates users, revokes sessions and journals erasure',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness(),
      original = globalThis.fetch,
      pair = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' },
      now = Math.floor(Date.now() / 1000);
    let since = now - 30,
      disabled = false;
    const deleted = new Set<string>(),
      minted = new Map<string, string>();
    async function mint(uid: string, email = uid + '@example.invalid', authTime = now - 10) {
      const token = await new SignJWT({
        auth_time: authTime,
        email,
        email_verified: true,
        name: uid,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
        .setSubject(uid)
        .setAudience(project)
        .setIssuer(`https://securetoken.google.com/${project}`)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(pair.privateKey);
      minted.set(token, uid);
      return token;
    }
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (
        url ===
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
      )
        return Response.json({ keys: [jwk] });
      assert.match(
        url,
        /^https:\/\/identitytoolkit.googleapis.com\/v1\/accounts:(lookup|delete)\?key=public-fixture-key$/,
      );
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(body), ['idToken']);
      const uid = minted.get(body.idToken);
      if (!uid || deleted.has(uid))
        return Response.json({ error: { message: 'USER_NOT_FOUND' } }, { status: 400 });
      if (url.includes('accounts:delete')) {
        deleted.add(uid);
        return Response.json({});
      }
      return Response.json({ users: [{ localId: uid, disabled, validSince: String(since) }] });
    }) as typeof fetch;
    const env = {
      APP_DATA_BACKEND: 'd1',
      AUTH_PROVIDER: 'firebase',
      FIREBASE_AUTH_ENABLED: 'true',
      FIREBASE_PROJECT_ID: project,
      FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com',
      FIREBASE_API_KEY: 'public-fixture-key',
      FIREBASE_APP_ID: 'synthetic-client-app',
      AUTH_JWT_SECRET: 'isolated-firebase-fixture-secret-with-over-32-characters-only',
    };
    let persisted: Awaited<ReturnType<typeof exchangeFirebaseSession>> | undefined;
    try {
      const router = new MultiD1(h.db);
      await withApplicationBindings(
        {
          db: h.db.D1_USERS,
          multiD1: router,
          objects: router.users().objects,
          env,
        },
        async () => {
          const repo = new D1AuthRepository(router.users()),
            at = await mint('owner-a'),
            bt = await mint('owner-b');
          const nextRequest = () => {
            assert(router.metrics.statements <= 50);
            Object.assign(router.metrics, requestMetrics());
          };
          const a = await exchangeFirebaseSession(at, undefined, { mobile: true });
          nextRequest();
          const b = await exchangeFirebaseSession(bt, undefined, { mobile: true });
          nextRequest();
          assert.notEqual(a.user.id, b.user.id);
          nextRequest();
          const webTimings: AuthTiming[] = [];
          const web = await withAuthTimings(webTimings, () =>
            exchangeFirebaseSession(at, undefined, {}),
          );
          assert.equal(
            web.accessToken,
            undefined,
            'web cookie exchange must not sign a discarded native JWT',
          );
          assert(!webTimings.some((t) => t.stage === 'session.sign'));
          assert(webTimings.some((t) => t.stage === 'session.create'));
          const expires = await repo.findSessionByToken(web.refreshToken);
          assert.equal(expires?.expires_at.getTime(), (now + 3600) * 1000);
          nextRequest();
          const count = (await repo.s.rows<any>('SELECT count(*) AS n FROM app_sessions'))[0].n;
          await assert.rejects(
            repo.createSession({
              userId: b.user.id,
              token: 'synthetic-atomic-failure-token',
              previousToken: b.refreshToken,
              expiresAt: new Date((now + 3600) * 1000),
              firebase: { identityHash: null, idTokenCiphertext: 'synthetic' },
            }),
          );
          assert.equal(
            (await repo.s.rows<any>('SELECT count(*) AS n FROM app_sessions'))[0].n,
            count,
          );
          assert.equal(
            (await repo.findSessionByToken(b.refreshToken))?.revoked_at,
            null,
            'failed association insert must roll back prior revocation',
          );
          nextRequest();

          nextRequest();
          assert.equal((await userFromSessionToken(a.refreshToken))?.id, a.user.id);
          nextRequest();
          assert.equal((await userFromAccessToken(b.accessToken))?.id, b.user.id);
          assert.equal((await repo.s.rows('SELECT * FROM app_credentials')).length, 0);
          const [stored] = await repo.s.rows<any>(
            'SELECT * FROM app_firebase_sessions WHERE user_id=?',
            [a.user.id],
          );
          assert.notEqual(stored.id_token_ciphertext, at);
          assert.equal((await exchangeFirebaseSession(at, b.refreshToken, {})).user.id, a.user.id);
          nextRequest();
          assert.equal((await userFromSessionToken(b.refreshToken))?.id, b.user.id);
          nextRequest();
          await repo.revokeSessionToken(a.refreshToken);
          assert.equal(await userFromSessionToken(a.refreshToken), null);
          nextRequest();
          const unbound = await issueSession(a.user.id, {});
          assert.equal(await userFromSessionToken(unbound.refreshToken), null);
          await assert.rejects(hashPassword('password-must-never-reach-argon'));
          assert.equal(
            (
              await legacyLogin(
                new NextRequest('https://fixture.invalid/api/auth/login', { method: 'POST' }),
              )
            ).status,
            404,
          );
          nextRequest();
          since = now;
          assert.equal(await userFromAccessToken(b.accessToken), null);
          since = now - 30;
          nextRequest();
          disabled = true;
          assert.equal(await userFromSessionToken(b.refreshToken), null);
          disabled = false;
          nextRequest();
          const existing = await repo.createEmailUser({
            email: 'collision@example.invalid',
            passwordHash: 'unchanged-fixture',
          });
          await assert.rejects(
            exchangeFirebaseSession(
              await mint('collision', 'collision@example.invalid'),
              undefined,
              {},
            ),
          );
          assert(await repo.findUserById(existing!.id));
          nextRequest();
          await assert.rejects(deleteFirebaseIdentity(b.user.id, at), /Identity does not belong/);
          since = now - 1000;
          await assert.rejects(
            deleteFirebaseIdentity(
              b.user.id,
              await mint('owner-b', 'owner-b@example.invalid', now - 600),
            ),
            /Sign out and sign in/,
          );
          since = now - 30;
          nextRequest();
          await revokeFirebaseUserSessions(a.user.id);
          await repo.revokeAllSessions(a.user.id);
          nextRequest();
          await assert.rejects(exchangeFirebaseSession(at, undefined, { mobile: true }));
          nextRequest();
          const hash = await deleteFirebaseIdentity(b.user.id, bt);
          assert(deleted.has('owner-b'));
          nextRequest();
          assert.equal(
            (await resumeFirebaseErasures()).resumed,
            1,
            'acknowledged provider deletion resumes D1 cleanup without repeating provider deletion',
          );
          assert.equal(await userFromSessionToken(b.refreshToken), null);
          const [journal] = await repo.s.rows<any>(
            'SELECT * FROM app_firebase_deletions WHERE identity_hash=?',
            [hash],
          );
          assert.equal(journal.provider_deleted, 1);
          assert.equal(journal.erasure_requested, 1);
          assert.equal(journal.user_id, null);
          assert(await repo.findUserById(a.user.id));
          const sealed = await sealFirebaseLedger(
            h.db.D1_USERS,
            'isolated-synthetic-backup-secret-long-enough',
          );
          const ledger = await openFirebaseLedger(
            sealed,
            'isolated-synthetic-backup-secret-long-enough',
          );
          assert(ledger.revocations.some((r) => r.identity_hash === hash && r.deleted === 1));
          await replayFirebaseLedger(h.db.D1_USERS, ledger);
          const stale = {
            ...ledger,
            revocations: ledger.revocations.map((r) => ({ ...r, deleted: 0, revoked_before: 0 })),
          };
          await replayFirebaseLedger(h.db.D1_USERS, stale);
          assert.equal(
            (
              await h.db.D1_USERS.prepare(
                'SELECT deleted FROM app_firebase_revocations WHERE identity_hash=?',
              )
                .bind(hash)
                .first<any>()
            )?.deleted,
            1,
          );
          nextRequest();
          persisted = await exchangeFirebaseSession(await mint('restart-owner'), undefined, {});
          await assert.rejects(
            openFirebaseLedger(sealed, 'incorrect-synthetic-backup-secret-long-enough'),
          );
        },
      );
      await h.restart();
      const fresh = new MultiD1(h.db);
      await withApplicationBindings(
        { db: h.db.D1_USERS, multiD1: fresh, objects: fresh.users().objects, env },
        async () => {
          assert(persisted);
          assert.equal((await userFromSessionToken(persisted.refreshToken))?.id, persisted.user.id);
        },
      );
    } finally {
      globalThis.fetch = original;
      await h.close();
    }
  },
);
