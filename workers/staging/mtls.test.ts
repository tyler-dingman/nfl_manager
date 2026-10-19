import test from 'node:test';
import assert from 'node:assert/strict';
import { mtlsGate } from './mtls';
test('mTLS gate denies missing, spoofed, revoked and wrong-host certificates before dispatch', async () => {
  let calls = 0;
  const gate = mtlsGate({
    async fetch() {
      calls++;
      return new Response('private');
    },
  });
  const env = { STAGING_MTLS_HOST: 'staging.example.invalid', STAGING_MTLS_SHA256: 'a'.repeat(64) };
  const request = (tls?: any, url = 'https://staging.example.invalid/') => {
    const r = new Request(url, {
      headers: { 'Cf-Tls-Client-Auth': 'SUCCESS', 'X-Client-Cert': 'a'.repeat(64) },
    });
    if (tls) Object.defineProperty(r, 'cf', { value: { tlsClientAuth: tls } });
    return r;
  };
  const good = {
    certPresented: '1',
    certVerified: 'SUCCESS',
    certRevoked: '0',
    certFingerprintSHA256: 'a'.repeat(64),
  };
  for (const r of [
    request(),
    request({ ...good, certRevoked: '1' }),
    request({ ...good, certVerified: 'NONE' }),
    request({ ...good, certFingerprintSHA256: 'b'.repeat(64) }),
    request(good, 'https://other.invalid/'),
  ])
    assert.equal((await gate.fetch(r, env, {})).status, 403);
  assert.equal(calls, 0);
  assert.equal((await gate.fetch(request(good), env, {})).status, 200);
  assert.equal((await gate.fetch(request(good), {}, {})).status, 403);
  assert.equal(calls, 1);
});
