import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { NextRequest } from 'next/server';
import { hasApplicationSession } from './application-session';
import { middleware } from '../middleware';

const symbol = Symbol.for('__cloudflare-context__');
const globals = globalThis as any;
const scope = new AsyncLocalStorage<any>();
const request = (token = 'opaque-a') =>
  new NextRequest('https://staging.example/front-office?team=KC', {
    headers: {
      cookie: `dd_session=${token}; __Host-dd_staging=outer-credential; unrelated=private`,
      authorization: 'Bearer spoofed-user',
      'x-user-id': 'spoofed-user',
    },
  });

test('Cloudflare SSR uses private API transport, isolates credentials and preserves fail-closed behavior', async () => {
  const previous = Object.getOwnPropertyDescriptor(globals, symbol);
  const fetch = globalThis.fetch;
  const runtime = process.env.APP_RUNTIME;
  const preview = process.env.PRELAUNCH_MODE;
  Object.defineProperty(globals, symbol, { configurable: true, get: () => scope.getStore() });
  process.env.APP_RUNTIME = 'cloudflare';
  process.env.PRELAUNCH_MODE = 'false';
  let publicFetches = 0;
  globalThis.fetch = async () => {
    publicFetches++;
    throw Error('Worker public self-fetch forbidden');
  };
  const invoke = (reply: (r: Request) => Promise<Response>, token = 'opaque-a') =>
    scope.run({ env: { API_SERVICE: { fetch: reply } } }, () => middleware(request(token)));
  try {
    const response = await invoke(async (r) => {
      assert.equal(r.url, 'https://staging.example/api/auth/me');
      assert.equal(r.method, 'GET');
      assert.equal(r.redirect, 'manual');
      assert.equal(r.headers.get('cookie'), 'dd_session=opaque-a');
      assert.equal(r.headers.get('authorization'), null);
      assert.equal(r.headers.get('x-user-id'), null);
      return Response.json({ ok: true, user: { id: 'user-a' } });
    });
    assert.equal(response.headers.get('x-middleware-next'), '1');
    for (const token of ['invalid', 'expired', 'revoked']) {
      const denied = await invoke(
        async () => Response.json({ ok: false, user: null }, { status: 401 }),
        token,
      );
      const url = new URL(denied.headers.get('location')!);
      assert.equal(url.pathname, '/login');
      assert.equal(url.searchParams.get('next'), '/front-office?team=KC');
    }
    for (const reply of [
      async () =>
        new Response(null, { status: 307, headers: { location: 'https://untrusted.invalid' } }),
      async () => new Response('Unavailable', { status: 503 }),
      async () => new Response('not-json'),
      async () => {
        throw Error('Binding unavailable');
      },
    ])
      assert.equal((await invoke(reply)).status, 503);
    const malformed = await invoke(async () => Response.json({ ok: true, user: { id: 42 } }));
    assert.equal(new URL(malformed.headers.get('location')!).pathname, '/login');
    assert.equal((await scope.run({ env: {} }, () => middleware(request()))).status, 503);
    assert.equal((await middleware(request())).status, 503);
    assert.equal(publicFetches, 0);
  } finally {
    globalThis.fetch = fetch;
    if (previous) Object.defineProperty(globals, symbol, previous);
    else delete globals[symbol];
    if (runtime === undefined) delete process.env.APP_RUNTIME;
    else process.env.APP_RUNTIME = runtime;
    if (preview === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = preview;
  }
});

test('concurrent OpenNext request contexts never share an API service or cookie', async () => {
  const previous = Object.getOwnPropertyDescriptor(globals, symbol);
  Object.defineProperty(globals, symbol, { configurable: true, get: () => scope.getStore() });
  const seen: string[] = [];
  try {
    await Promise.all(
      ['a', 'b'].map((id) =>
        scope.run(
          {
            env: {
              API_SERVICE: {
                async fetch(r: Request) {
                  await new Promise((resolve) => setTimeout(resolve, id === 'a' ? 8 : 1));
                  assert.equal(r.headers.get('cookie'), `dd_session=opaque-${id}`);
                  seen.push(id);
                  return Response.json({ ok: true, user: { id } });
                },
              },
            },
          },
          async () => assert.equal(await hasApplicationSession(request('opaque-' + id)), true),
        ),
      ),
    );
    assert.deepEqual(seen.sort(), ['a', 'b']);
  } finally {
    if (previous) Object.defineProperty(globals, symbol, previous);
    else delete globals[symbol];
  }
});
