import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import {
  verifyFirebaseSignature,
  assertFirebaseAccount,
  firebaseAccountRequest,
} from './firebase-token';
const project = 'synthetic-firebase-fixture';
const now = Math.floor(Date.now() / 1000);
const fixture = generateKeyPair('RS256').then(async (pair) => ({
  pair,
  keys: createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' }],
  }),
}));
async function token(overrides: Record<string, unknown> = {}, foreign = false) {
  const { pair } = await fixture;
  return new SignJWT({
    sub: 'synthetic-owner-a',
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    exp: now + 3600,
    iat: now,
    auth_time: now - 10,
    email: 'a@example.invalid',
    email_verified: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(foreign ? (await generateKeyPair('RS256')).privateKey : pair.privateKey);
}
test('Firebase signatures pin issuer, audience, algorithm, expiration, UID, auth time and tenant', async () => {
  const { keys } = await fixture;
  const valid = await verifyFirebaseSignature(await token(), project, keys);
  assert.equal(valid.uid, 'synthetic-owner-a');
  for (const overrides of [
    { exp: now - 1 },
    { aud: 'other-project' },
    { iss: 'https://attacker.invalid' },
    { sub: '' },
    { sub: 'x'.repeat(129) },
    { auth_time: now + 100 },
    { auth_time: '123' },
    { iat: now + 60 },
    { firebase: { tenant: 'unexpected' } },
  ])
    await assert.rejects(verifyFirebaseSignature(await token(overrides), project, keys));
  await assert.rejects(verifyFirebaseSignature(await token({}, true), project, keys));
  await assert.rejects(verifyFirebaseSignature('', project, keys));
  await assert.rejects(verifyFirebaseSignature('forged.token.payload', project, keys));
});
test('online account state fails closed for disabled, deleted, revoked, wrong UID and missing metadata', async () => {
  const { keys } = await fixture;
  const identity = await verifyFirebaseSignature(await token(), project, keys);
  assert.doesNotThrow(() =>
    assertFirebaseAccount(identity, { localId: identity.uid, validSince: String(now - 30) }),
  );
  for (const account of [
    undefined,
    { localId: identity.uid, disabled: true, validSince: '1' },
    { localId: 'synthetic-owner-b', validSince: '1' },
    { localId: identity.uid },
    { localId: identity.uid, validSince: String(now) },
  ])
    assert.throws(() => assertFirebaseAccount(identity, account));
});
test('account operations use fixed HTTPS, reject redirects/errors, and never send a password', async () => {
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(
      String(url),
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=public-fixture-key',
    );
    assert.equal(init?.redirect, 'manual');
    assert.deepEqual(JSON.parse(String(init?.body)), { idToken: 'signed-fixture' });
    return Response.json({ users: [{ localId: 'owner', validSince: '1' }] });
  }) as typeof fetch;
  assert.equal(
    (await firebaseAccountRequest('lookup', 'public-fixture-key', 'signed-fixture', request))
      .users?.[0].localId,
    'owner',
  );
  await assert.rejects(
    firebaseAccountRequest(
      'lookup',
      'public-fixture-key',
      'fixture',
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://untrusted.invalid' },
        })) as typeof fetch,
    ),
  );
  await assert.rejects(
    firebaseAccountRequest('lookup', 'public-fixture-key', 'fixture', (async () =>
      Response.json({}, { status: 401 })) as typeof fetch),
  );
});
