import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, secureToken, tokenHash, verifyPassword } from './crypto';
import { safeRedirect } from './http';

test('Argon2id hashes and verifies passwords without storing plaintext', async () => {
  const password = 'correct horse battery staple';
  const encoded = await hashPassword(password);
  assert.match(encoded, /^\$argon2id\$/);
  assert.equal(encoded.includes(password), false);
  assert.equal(await verifyPassword(encoded, password), true);
  assert.equal(await verifyPassword(encoded, 'incorrect password'), false);
});

test('opaque tokens are random and stored as deterministic hashes', () => {
  const first = secureToken();
  const second = secureToken();
  assert.notEqual(first, second);
  assert.equal(tokenHash(first), tokenHash(first));
  assert.notEqual(tokenHash(first), first);
});

test('redirect validation rejects absolute and protocol-relative URLs', () => {
  assert.equal(safeRedirect('/account'), '/account');
  assert.equal(safeRedirect('//evil.example'), '/');
  assert.equal(safeRedirect('https://evil.example'), '/');
});
