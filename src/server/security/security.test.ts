import assert from 'node:assert/strict';
import test from 'node:test';

import { requiresPkce } from '@/server/auth/pkce';
import { isAllowedAdminUser } from '@/server/admin/authorization';

test('native authorization-code exchange requires a PKCE verifier', () => {
  assert.equal(requiresPkce('authorization-code', null), false);
  assert.equal(requiresPkce('authorization-code', 'a'.repeat(43)), true);
  assert.equal(requiresPkce(null, null), true);
});

test('admin access requires an explicitly configured user id', () => {
  assert.equal(isAllowedAdminUser('user-1', 'user-1,user-2'), true);
  assert.equal(isAllowedAdminUser('user-3', 'user-1,user-2'), false);
  assert.equal(isAllowedAdminUser(null, 'user-1'), false);
});