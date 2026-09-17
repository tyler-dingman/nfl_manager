import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { isMobileAuthRoute, hasMobilePreviewAccess } from '../../lib/mobile-preview-access';

process.env.AUTH_JWT_SECRET = 'mobile-auth-test-secret-not-for-production-0001';
process.env.DATABASE_URL = 'postgresql://localhost:5432/mobile_auth_test';
const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET);

test('PKCE accepts the RFC 7636 example and rejects a different verifier', async () => {
  const { matchesMobileVerifier, validMobileChallenge } = await import('./mobile-handoff');
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(validMobileChallenge(challenge), true);
  assert.equal(matchesMobileVerifier(challenge, verifier), true);
  assert.equal(matchesMobileVerifier(challenge, 'x'.repeat(43)), false);
  assert.equal(matchesMobileVerifier(challenge, 'short'), false);
  assert.equal(validMobileChallenge('not-a-challenge'), false);
});

test('handoff rejects expired, wrong-audience, and wrong-verifier tickets before database use', async () => {
  const { consumeMobileHandoff } = await import('./mobile-handoff');
  const verifier = 'v'.repeat(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const ticket = (audience: string, expiry: string) =>
    new SignJWT({ challenge })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user')
      .setJti('one-use')
      .setIssuer('down-distance')
      .setAudience(audience)
      .setExpirationTime(expiry)
      .sign(secret);
  await assert.rejects(
    consumeMobileHandoff(await ticket('down-distance-mobile-handoff', '-1s'), verifier),
  );
  await assert.rejects(consumeMobileHandoff(await ticket('down-distance-api', '2m'), verifier));
  await assert.rejects(
    consumeMobileHandoff(await ticket('down-distance-mobile-handoff', '2m'), 'x'.repeat(64)),
  );
});

test('mobile OAuth state keeps the challenge and client state in the signed cookie', async () => {
  const { createOAuthState, readOAuthState } = await import('./oauth-state');
  const mobile = { challenge: 'c'.repeat(43), state: 's'.repeat(32) };
  const generated = await createOAuthState('google', '/', undefined, mobile);
  const read = await readOAuthState(generated.token);
  assert.deepEqual(read.mobile, mobile);
  assert.equal(read.state, generated.state);
  await assert.rejects(readOAuthState(generated.token + 'tampered'));
});

test('preview exemption is limited to login bootstraps and signed API access tokens', async () => {
  assert.equal(isMobileAuthRoute('/api/auth/mobile/exchange'), true);
  assert.equal(isMobileAuthRoute('/api/auth/social/apple/callback'), true);
  assert.equal(isMobileAuthRoute('/api/auth/signup'), false);
  assert.equal(isMobileAuthRoute('/api/auth/social/unknown/start'), false);
  assert.equal(isMobileAuthRoute('/api/admin/users'), false);
  const token = await new SignJWT({ sid: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user')
    .setIssuer('down-distance')
    .setAudience('down-distance-api')
    .setExpirationTime('15m')
    .sign(secret);
  assert.equal(await hasMobilePreviewAccess('/api/content/homepage', `Bearer ${token}`), true);
  assert.equal(await hasMobilePreviewAccess('/account', `Bearer ${token}`), false);
  assert.equal(await hasMobilePreviewAccess('/api/content/homepage', 'Bearer bogus'), false);
  assert.equal(await hasMobilePreviewAccess('/api/content/homepage', null), false);
});
