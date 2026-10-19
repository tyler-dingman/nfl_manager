import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { accessGate } from '../../workers/staging/access';
test('Access gate verifies signatures, claims and API/assets; identities alone cannot bypass', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const env = { ACCESS_TEAM_DOMAIN: 'synthetic.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64) };
  let calls = 0;
  const gate = accessGate(
    {
      fetch: async () => {
        calls++;
        return new Response('private');
      },
    },
    createLocalJWKSet({ keys: [await exportJWK(publicKey)] }),
  );
  const token = (aud = env.ACCESS_AUD, issuer = `https://${env.ACCESS_TEAM_DOMAIN}`, exp = '5m') =>
    new SignJWT({ type: 'app' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('synthetic')
      .setIssuedAt()
      .setExpirationTime(exp)
      .setIssuer(issuer)
      .setAudience(aud)
      .sign(privateKey);
  for (const path of [
    '/',
    '/api/auth/config',
    '/api/user/saved-content',
    '/_next/static/test.js',
  ]) {
    assert.equal(
      (
        await gate.fetch(
          new Request('https://staging.test' + path, {
            headers: { 'Cf-Access-Authenticated-User-Email': 'forged@example.test' },
          }),
          env,
          {},
        )
      ).status,
      403,
    );
    for (const jwt of [
      await token('b'.repeat(64)),
      await token(env.ACCESS_AUD, 'https://wrong.cloudflareaccess.com'),
      await token(env.ACCESS_AUD, `https://${env.ACCESS_TEAM_DOMAIN}`, '-1m'),
      'invalid',
    ])
      assert.equal(
        (
          await gate.fetch(
            new Request('https://staging.test' + path, {
              headers: { 'Cf-Access-Jwt-Assertion': jwt },
            }),
            env,
            {},
          )
        ).status,
        403,
      );
    const reply = await gate.fetch(
      new Request('https://staging.test' + path, {
        headers: { 'Cf-Access-Jwt-Assertion': await token() },
      }),
      env,
      {},
    );
    assert.equal(reply.status, 200);
    assert.equal(
      reply.headers.get('cache-control'),
      path.startsWith('/_next/static/') ? 'private, max-age=300, immutable' : 'private, no-store',
    );
  }
  const sensitiveAsset = accessGate(
    { fetch: async () => new Response('sensitive', { headers: { 'set-cookie': 'synthetic=1' } }) },
    createLocalJWKSet({ keys: [await exportJWK(publicKey)] }),
  );
  assert.equal(
    (
      await sensitiveAsset.fetch(
        new Request('https://staging.test/_next/static/test.js', {
          headers: { 'Cf-Access-Jwt-Assertion': await token() },
        }),
        env,
        {},
      )
    ).headers.get('cache-control'),
    'private, no-store',
  );
  assert.equal(calls, 4);
  assert.equal((await gate.fetch(new Request('https://staging.test'), {}, {})).status, 403);
});
