import { publicContentWithPreviewFallback } from './public-content-transport';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicContentClient } from './public-content-client';
import { publicContentPath } from './public-content-policy';
import { publicCacheKey, cachePublicResponse } from '../workers/web/public-cache';
test('public content allowlist rejects identity, unknown parameters, private routes and credentials', async () => {
  for (const path of [
    '/api/auth/me',
    '/api/user/home',
    '/api/front-office/state',
    '/api/parlay-lab/my-plays',
    '/api/content/homepage?team=KC&user=other',
    '/api/film-room?team=KC&team=SEA',
    'https://evil.invalid/api/parlay-lab/events',
  ])
    assert.equal(publicContentPath(path), null);
  assert.equal(publicContentPath('/api/parlay-lab/research?eventId=ALL'), null);
  assert.equal(
    publicContentPath('/api/parlay-lab/research?eventId=original-event&playerId=private'),
    null,
  );
  assert(publicContentPath('/api/parlay-lab/research?eventId=original-event'));
  assert(publicContentPath('/api/teams'));
  assert(publicContentPath('/api/mobile/stories/original-story'));
  assert.equal(publicContentPath('/api/content/homepage?team=kc'), '/api/content/homepage?team=KC');
  const credentials: Record<string, string>[] = [
    { cookie: 'dd_session=private' },
    { authorization: 'Bearer private' },
  ];
  for (const headers of credentials)
    assert.equal(
      publicCacheKey(
        new Request('https://local.invalid/api/content/homepage?team=KC', {
          headers: headers as Record<string, string>,
        }),
        'v1',
      ),
      null,
    );
  const request = new Request('https://local.invalid/api/film-room?team=KC');
  assert.notEqual(publicCacheKey(request, 'v1')!.url, publicCacheKey(request, 'v2')!.url);
  let writes = 0;
  const cache = {
    put: async () => {
      writes++;
    },
  };
  const rejected: Record<string, string>[] = [
    { 'set-cookie': 'a=b' },
    { 'cache-control': 'private' },
    { vary: 'Cookie' },
    { vary: 'Authorization' },
    { vary: '*' },
  ];
  for (const headers of rejected)
    assert.equal(
      await cachePublicResponse(
        cache,
        request,
        Response.json({}, { headers: headers as Record<string, string> }),
      ),
      false,
    );
  assert.equal(writes, 0);
});
test('web/native public client coalesces requests, isolates teams, expires and retries failures', async () => {
  let clock = 0,
    calls = 0;
  const client = createPublicContentClient(
    (async (path: string, init: RequestInit) => {
      calls++;
      assert.equal(init.credentials, 'omit');
      assert.equal(new Headers(init.headers).has('authorization'), false);
      return Response.json({ path, calls });
    }) as typeof fetch,
    () => clock,
  );
  const r = await Promise.all(
    Array.from({ length: 20 }, () => client('/api/content/homepage?team=KC')),
  );
  assert.equal(calls, 1);
  assert.equal((await r[0].json()).path, '/api/content/homepage?team=KC');
  assert.equal((await r[1].json()).calls, 1);
  await client('/api/content/homepage?team=SEA');
  assert.equal(calls, 2);
  clock = 15001;
  await client('/api/content/homepage?team=KC');
  assert.equal(calls, 3);
  await assert.rejects(client('/api/user/home'));
  assert.equal(calls, 3);
  let attempts = 0;
  const failing = createPublicContentClient((async () => {
    attempts++;
    return new Response('unavailable', { status: 503 });
  }) as typeof fetch);
  await failing('/api/parlay-lab/events');
  await failing('/api/parlay-lab/events');
  assert.equal(attempts, 2);
});

test('private preview retries retain authentication and never populate the anonymous cache', async () => {
  let anonymousCalls = 0,
    privateCalls = 0;
  const anonymous = createPublicContentClient((async () => {
    anonymousCalls++;
    return new Response('Preview required', { status: 401 });
  }) as typeof fetch);
  const owner = (path: string) =>
    publicContentWithPreviewFallback(path, anonymous, async () =>
      Response.json({ owner: ++privateCalls }),
    );
  assert.equal((await (await owner('/api/content/homepage?team=KC')).json()).owner, 1);
  assert.equal((await (await owner('/api/content/homepage?team=KC')).json()).owner, 2);
  assert.equal(anonymousCalls, 2);
  assert.equal(privateCalls, 2);
});
