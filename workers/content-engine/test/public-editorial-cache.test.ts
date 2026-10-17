import test from 'node:test';
import assert from 'node:assert/strict';
import { publicEditorialCacheKey, canStoreEditorialResponse } from '../src/public-editorial-cache';
test('public cache never shares authenticated, private, preference or saved-content responses', () => {
  for (const path of [
    '/api/user/saved-content',
    '/api/front-office/state',
    '/api/parlay-lab/my-plays',
    '/api/three-and-out/preferences',
    '/api/search',
  ])
    assert.equal(publicEditorialCacheKey(new Request(`https://local.invalid${path}`)), null);
  for (const headers of [{ authorization: 'Bearer private' }, { cookie: 'session=user-1' }])
    assert.equal(
      publicEditorialCacheKey(
        new Request('https://local.invalid/api/content/homepage', {
          headers: Object.fromEntries(
            Object.entries(headers).filter(([, value]) => value !== undefined),
          ),
        }),
      ),
      null,
    );
  assert.equal(
    publicEditorialCacheKey(new Request('https://local.invalid/api/content/wire?userId=user-2')),
    null,
  );
  const a = publicEditorialCacheKey(
    new Request('https://local.invalid/api/content/wire?team=kc&sort=latest'),
  );
  const b = publicEditorialCacheKey(
    new Request('https://local.invalid/api/content/wire?sort=latest&team=kc'),
  );
  assert.equal(a, b);
  assert.notEqual(
    a,
    publicEditorialCacheKey(
      new Request('https://local.invalid/api/content/wire?team=sea&sort=latest'),
    ),
  );
  assert.equal(
    canStoreEditorialResponse(
      new Response('{}', { headers: { 'cache-control': 'public,max-age=30' } }),
    ),
    true,
  );
  for (const headers of [
    { 'cache-control': 'private' },
    { 'cache-control': 'public', 'set-cookie': 'session=private' },
    { 'cache-control': 'public', vary: '*' },
  ])
    assert.equal(
      canStoreEditorialResponse(
        new Response('{}', {
          headers: Object.fromEntries(
            Object.entries(headers).filter(([, value]) => value !== undefined),
          ),
        }),
      ),
      false,
    );
});
