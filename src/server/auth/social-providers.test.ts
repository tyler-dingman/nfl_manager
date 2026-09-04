import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { configuredSocialProviders } from './config';
import { normalizeAppleIdentity } from './providers/apple';
import { normalizeFacebookProfile } from './providers/facebook';

const emptyConfig = {
  DATABASE_URL: undefined,
  AUTH_BASE_URL: undefined,
  AUTH_JWT_SECRET: undefined,
  APPLE_CLIENT_ID: undefined,
  APPLE_IOS_CLIENT_ID: undefined,
  APPLE_TEAM_ID: undefined,
  APPLE_KEY_ID: undefined,
  APPLE_PRIVATE_KEY: undefined,
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_IOS_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  FACEBOOK_APP_ID: undefined,
  FACEBOOK_APP_SECRET: undefined,
};

test('Facebook is enabled only with both required values', () => {
  assert.equal(configuredSocialProviders(emptyConfig).facebook, false);
  assert.equal(
    configuredSocialProviders({ ...emptyConfig, FACEBOOK_APP_ID: 'app' }).facebook,
    false,
  );
  assert.equal(
    configuredSocialProviders({
      ...emptyConfig,
      FACEBOOK_APP_ID: 'app',
      FACEBOOK_APP_SECRET: 'secret',
    }).facebook,
    true,
  );
});

test('Apple is enabled only with the complete web credential set', () => {
  assert.equal(configuredSocialProviders(emptyConfig).apple, false);
  assert.equal(
    configuredSocialProviders({
      ...emptyConfig,
      APPLE_CLIENT_ID: 'service.id',
      APPLE_TEAM_ID: 'team',
      APPLE_KEY_ID: 'key',
    }).apple,
    false,
  );
  assert.equal(
    configuredSocialProviders({
      ...emptyConfig,
      APPLE_CLIENT_ID: 'service.id',
      APPLE_TEAM_ID: 'team',
      APPLE_KEY_ID: 'key',
      APPLE_PRIVATE_KEY: 'pem',
    }).apple,
    true,
  );
});

test('Facebook profiles support normal and missing-email responses safely', () => {
  const full = normalizeFacebookProfile(
    {
      id: 'facebook-1',
      email: 'fan@example.com',
      name: 'Football Fan',
      first_name: 'Football',
      last_name: 'Fan',
      picture: { data: { url: 'https://example.com/avatar.jpg' } },
    },
    'facebook-1',
  );
  assert.equal(full.providerSubject, 'facebook-1');
  assert.equal(full.email, 'fan@example.com');
  assert.equal(full.emailVerified, false);
  assert.equal(normalizeFacebookProfile({ id: 'facebook-2' }, 'facebook-2').email, null);
  assert.throws(
    () => normalizeFacebookProfile({ id: 'other-user' }, 'facebook-2'),
    /does not match/,
  );
});

test('Apple captures first-login data, relay email, and tolerates later sparse responses', () => {
  const first = normalizeAppleIdentity(
    { sub: 'apple-1', email: 'relay@privaterelay.appleid.com', email_verified: 'true' },
    JSON.stringify({
      name: { firstName: 'Patrick', lastName: 'Fan' },
      email: 'relay@privaterelay.appleid.com',
    }),
  );
  assert.equal(first.displayName, 'Patrick Fan');
  assert.equal(first.email, 'relay@privaterelay.appleid.com');
  assert.equal(first.emailVerified, true);
  const later = normalizeAppleIdentity({ sub: 'apple-1' });
  assert.equal(later.displayName, null);
  assert.equal(later.email, null);
  assert.throws(() => normalizeAppleIdentity({}), /subject/);
});

test('web callbacks reject denial/state failures and identities require explicit safe linking', () => {
  const callback = readFileSync('src/app/api/auth/social/[provider]/callback/route.ts', 'utf8');
  const repository = readFileSync('src/server/auth/repository.ts', 'utf8');
  assert.match(callback, /values\.get\('error'\)/);
  assert.match(
    callback,
    /state\.provider !== providerName \|\| state\.state !== values\.get\('state'\)/,
  );
  assert.match(repository, /Sign in to that account and connect this provider from Security/);
  assert.match(repository, /provider_email = COALESCE/);
  assert.match(repository, /provider_display_name = COALESCE/);
});

test('provider implementations retain minimal scopes and server-side validation', () => {
  const facebook = readFileSync('src/server/auth/providers/facebook.ts', 'utf8');
  const apple = readFileSync('src/server/auth/providers/apple.ts', 'utf8');
  assert.match(facebook, /scope: 'email,public_profile'/);
  assert.match(facebook, /debug_token/);
  assert.match(apple, /scope: 'name email'/);
  assert.match(apple, /new SignJWT/);
  assert.match(apple, /jwtVerify/);
  assert.match(apple, /payload\.nonce !== nonce/);
});
