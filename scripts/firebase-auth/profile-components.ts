/** Offline Node CPU controls. They complement workerd sampling, never qualify hosted CPU. */
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { verifyFirebaseSignature } from '../../src/server/auth/firebase-token';
import { encryptSecret, secureToken } from '../../src/server/auth/crypto';
import { setSessionCookie } from '../../src/server/auth/http';
import { exchangeFirebaseSession } from '../../src/server/auth/firebase-service';
import { withAuthTimings, type AuthTiming } from '../../src/server/auth/performance';
import { withApplicationBindings } from '../../src/server/persistence/bindings';
import { MultiD1 } from '../../packages/storage/multi-d1';
import { D1AuthRepository } from '../../packages/storage/auth';
import { multiHarness } from '../../workers/content-engine/test/multi-harness';
async function main() {
  const out = 'reports/firebase-cpu-root-cause';
  await mkdir(out, { recursive: true });
  const pair = await generateKeyPair('RS256'),
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' },
    now = Math.floor(Date.now() / 1000),
    project = 'synthetic-component-profile';
  const cpu = () => {
    const c = process.cpuUsage();
    return (c.user + c.system) / 1000;
  };
  const token = await new SignJWT({
    auth_time: now - 10,
    email: 'synthetic@example.invalid',
    email_verified: true,
  })
    .setSubject('synthetic')
    .setAudience(project)
    .setIssuer('https://securetoken.google.com/' + project)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(pair.privateKey);
  const environment = {
    APP_DATA_BACKEND: 'd1',
    AUTH_PROVIDER: 'firebase',
    FIREBASE_AUTH_ENABLED: 'true',
    FIREBASE_PROJECT_ID: project,
    FIREBASE_API_KEY: 'synthetic-key',
    FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com',
    FIREBASE_APP_ID: 'synthetic-app',
    AUTH_JWT_SECRET: 'synthetic-component-secret-at-least-64-characters-only',
  };
  const rows: any[] = [];
  const publicUser = {
    id: 'synthetic',
    displayName: 'Synthetic',
    primaryEmail: 'synthetic@example.invalid',
    status: 'ACTIVE',
    emailVerified: true,
  };
  async function bench(operation: string, count: number, fn: () => unknown | Promise<unknown>) {
    const batches = [];
    for (let batch = 0; batch < 5; batch++) {
      const start = cpu(),
        wall = performance.now();
      for (let i = 0; i < count; i++) await fn();
      batches.push({ cpuMs: cpu() - start, elapsedMs: performance.now() - wall });
    }
    rows.push({
      operation,
      iterationsPerBatch: count,
      batches,
      meanNodeCpuMsPerOperation:
        batches.reduce((s, r) => s + r.cpuMs, 0) / (count * batches.length),
    });
  }
  await bench('empty async loop control', 1000, () => {});
  await bench('jose public JWK import (no retrieval/network)', 100, () => importJWK(jwk, 'RS256'));
  await bench('actual verifyFirebaseSignature with imported key, including all claims', 100, () =>
    verifyFirebaseSignature(token, project, () => pair.publicKey),
  );
  await withApplicationBindings(
    { db: {} as any, objects: {} as any, env: environment },
    async () => {
      await bench(
        'actual AES-GCM encryptSecret (includes key derivation and randomness)',
        300,
        () => encryptSecret(token),
      );
      await bench('actual secureToken(48)', 500, () => secureToken(48));
      await bench('NextResponse JSON serialization control', 500, () =>
        NextResponse.json({ ok: true, user: publicUser }),
      );
      const response = NextResponse.json({ ok: true });
      const opaque = secureToken(48),
        expiry = new Date(Date.now() + 3600000);
      await bench('actual opaque session cookie serialization (NOT signing)', 500, () =>
        setSessionCookie(response, opaque, expiry),
      );
    },
  );
  const original = globalThis.fetch,
    h = await multiHarness(),
    issued = new Map<string, string>();
  let keyFetches = 0,
    providerLookups = 0;
  const lookups: any[] = [];
  let current = '';
  const originalById = D1AuthRepository.prototype.findUserById,
    originalByEmail = D1AuthRepository.prototype.findUserByEmail;
  for (const name of ['findUserById', 'findUserByEmail'] as const) {
    const originalMethod = D1AuthRepository.prototype[name];
    D1AuthRepository.prototype[name] = async function (value: string) {
      const start = cpu(),
        wall = performance.now();
      try {
        return await originalMethod.call(this, value);
      } finally {
        lookups.push({
          operation: current,
          stage: 'd1.user_lookup',
          method: name,
          nodeCpuMs: cpu() - start,
          elapsedMs: performance.now() - wall,
        });
      }
    };
  }
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    if (String(input).startsWith('https://www.googleapis.com/')) {
      keyFetches++;
      return Response.json({ keys: [jwk] });
    }
    assert(String(input).startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?'));
    providerLookups++;
    const uid = issued.get(JSON.parse(String(init?.body)).idToken);
    assert(uid);
    return Response.json({ users: [{ localId: uid, validSince: String(now - 60) }] });
  }) as typeof fetch;
  const exchanges: any[] = [];
  try {
    await h.db.D1_USERS.prepare(
      'INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)',
    ).run();
    let previous: string | undefined;
    for (let i = 0; i < 12; i++) {
      const existing = i >= 6,
        uid = 'fixture-' + (existing ? 5 : i),
        jwt = await new SignJWT({
          auth_time: now - 10,
          email: uid + '@example.invalid',
          email_verified: true,
        })
          .setSubject(uid)
          .setAudience(project)
          .setIssuer('https://securetoken.google.com/' + project)
          .setIssuedAt(now)
          .setExpirationTime(now + 3600)
          .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
          .sign(pair.privateKey);
      issued.set(jwt, uid);
      const router = new MultiD1(h.db),
        timings: AuthTiming[] = [];
      current = (i === 0 ? 'first-web' : existing ? 'existing-web' : 'new-web') + '-' + i;
      const start = cpu(),
        wall = performance.now();
      const result = await withApplicationBindings(
        { db: h.db.D1_USERS, multiD1: router, objects: router.users().objects, env: environment },
        () =>
          withAuthTimings(
            timings,
            () => exchangeFirebaseSession(jwt, existing ? previous : undefined, { mobile: false }),
            cpu,
          ),
      );
      assert(result.user.id);
      assert.equal(result.accessToken, undefined);
      previous = result.refreshToken;
      exchanges.push({
        operation: current,
        nodeCpuMs: cpu() - start,
        elapsedMs: performance.now() - wall,
        d1: { ...router.metrics },
        stages: timings,
      });
    }
    assert.equal(keyFetches, 1);
    assert.equal(providerLookups, 12);
    await writeFile(
      out + '/component-cpu.json',
      JSON.stringify(
        {
          source:
            'Sequential local Node process.cpuUsage. Includes Node transport/crypto-helper work, excludes D1 workerd child CPU. NOT Cloudflare or workerd CPU accounting. Nested spans overlap; no subtraction or summation as exclusive CPU.',
          microbenchmarks: rows,
          exchanges,
          userLookups: lookups,
          keyFetches,
          providerLookups,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    globalThis.fetch = original;
    D1AuthRepository.prototype.findUserById = originalById;
    D1AuthRepository.prototype.findUserByEmail = originalByEmail;
    await h.close();
  }
  console.log(
    'Bounded component CPU controls PASS; Node-only measurement, never hosted qualification.',
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
