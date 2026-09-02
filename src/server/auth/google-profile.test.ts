import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeGoogleProfile } from './providers/google';

test('Google profile picture is normalized into the canonical avatar URL', () => {
  const identity = normalizeGoogleProfile({
    sub: 'google-user-1',
    email: 'fan@example.com',
    email_verified: true,
    name: 'Tyler Fan',
    given_name: 'Tyler',
    family_name: 'Fan',
    picture: 'https://lh3.googleusercontent.com/a/example',
  });

  assert.equal(identity.provider, 'GOOGLE');
  assert.equal(identity.avatarUrl, 'https://lh3.googleusercontent.com/a/example');
});

test('Google profile without a picture has a null canonical avatar URL', () => {
  assert.equal(normalizeGoogleProfile({ sub: 'google-user-2' }).avatarUrl, null);
});
