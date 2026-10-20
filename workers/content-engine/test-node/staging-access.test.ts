import { authorizedStagingDispatch } from '../../staging/authorized-dispatch';
import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { stagingAccessGate } from '../../staging/credential-access';

test(
  'workers.dev gate protects assets/pages/auth/APIs, verifies host-bound expiring cookies, and fails closed',
  { timeout: 60000 },
  async () => {
    const h = await multiHarness();
    try {
      const host = 'down-distance-rc3-staging-web.example.workers.dev',
        origin = 'https://' + host;
      let now = Date.now(),
        calls = 0,
        assetCalls = 0;
      const env = {
        STAGING_ACCESS_SECRET: 's'.repeat(64),
        STAGING_ACCESS_HOST: host,
        STAGING_ACCESS_EXPIRES_AT: new Date(now + 86400000).toISOString(),
        D1_USERS: h.db.D1_USERS,
        ASSETS: {
          async fetch(request: Request) {
            assetCalls++;
            return new Response('authorized static asset', {
              status: new URL(request.url).pathname.startsWith('/_next/static/') ? 200 : 404,
            });
          },
        },
      };
      const gate = stagingAccessGate(
        authorizedStagingDispatch({
          async fetch() {
            calls++;
            return new Response('protected app');
          },
        }),
        () => now,
      );
      const get = (path: string, cookie?: string) =>
        new Request(origin + path, { headers: cookie ? { cookie } : {} });
      for (const path of [
        '/',
        '/_next/static/main.js',
        '/favicon.ico',
        '/api/auth/config',
        '/api/auth/signup',
        '/api/user/saved',
        '/%2fapi/auth/config',
      ])
        assert.equal((await gate.fetch(get(path), env, {})).status, 403);
      assert.equal(calls, 0);
      assert.equal(assetCalls, 0, 'unauthorized requests must never reach the real asset binding');
      assert.equal(
        (
          await gate.fetch(
            new Request(origin + '/?credential=' + env.STAGING_ACCESS_SECRET),
            env,
            {},
          )
        ).status,
        403,
      );
      const login = (credential: string, originHeader = origin) =>
        new Request(origin + '/__staging/access', {
          method: 'POST',
          headers: {
            origin: originHeader,
            'content-type': 'application/x-www-form-urlencoded',
            'cf-connecting-ip': '192.0.2.1',
          },
          body: new URLSearchParams({ credential }),
        });
      assert.equal(
        (await gate.fetch(login(env.STAGING_ACCESS_SECRET, 'https://evil.invalid'), env, {}))
          .status,
        403,
      );
      assert.equal((await gate.fetch(login('invalid'), env, {})).status, 401);
      const response = await gate.fetch(login(env.STAGING_ACCESS_SECRET), env, {});
      assert.equal(response.status, 303);
      const set = response.headers.get('set-cookie')!;
      assert.ok(
        set.includes('HttpOnly') && set.includes('Secure') && set.includes('SameSite=Strict'),
      );
      assert.ok(!set.includes(env.STAGING_ACCESS_SECRET));
      const cookie = set.split(';')[0];
      for (const path of ['/', '/_next/static/main.js', '/api/auth/config']) {
        const result = await gate.fetch(get(path, cookie), env, {});
        assert.equal(result.status, 200);
        assert.equal(
          await result.text(),
          path.startsWith('/_next/static/') ? 'authorized static asset' : 'protected app',
        );
        assert.equal(result.headers.get('cache-control'), 'private, no-store');
      }
      assert.equal(calls, 2);
      assert.equal(assetCalls, 2);
      assert.equal((await gate.fetch(get('/', cookie + 'x'), env, {})).status, 403);
      assert.equal((await gate.fetch(get('/', cookie + '; ' + cookie), env, {})).status, 403);
      assert.equal(
        (
          await gate.fetch(
            new Request('https://other.workers.dev/', { headers: { cookie } }),
            env,
            {},
          )
        ).status,
        503,
      );
      assert.equal(
        (await gate.fetch(get('/', cookie), { ...env, STAGING_ACCESS_SECRET: '' }, {})).status,
        503,
      );
      assert.equal(
        (await gate.fetch(get('/', cookie), { ...env, D1_USERS: undefined }, {})).status,
        503,
      );
      now += 3601000;
      assert.equal((await gate.fetch(get('/', cookie), env, {})).status, 403);
      assert.equal(calls, 2);
      assert.equal(assetCalls, 2);
    } finally {
      await h.close();
    }
  },
);

test(
  'staging credential attempts are durably limited across gate instances; D1 failure denies access',
  { timeout: 60000 },
  async () => {
    const h = await multiHarness();
    try {
      const host = 'protected.example.workers.dev',
        origin = 'https://' + host,
        now = Date.now();
      const env = {
        STAGING_ACCESS_SECRET: 'k'.repeat(64),
        STAGING_ACCESS_HOST: host,
        STAGING_ACCESS_EXPIRES_AT: new Date(now + 86400000).toISOString(),
        D1_USERS: h.db.D1_USERS,
      };
      const request = () =>
        new Request(origin + '/__staging/access', {
          method: 'POST',
          headers: {
            origin,
            'content-type': 'application/x-www-form-urlencoded',
            'cf-connecting-ip': '192.0.2.10',
          },
          body: 'credential=invalid',
        });
      const downstream = {
        async fetch() {
          throw Error('must not dispatch');
        },
      };
      for (let i = 0; i < 4; i++)
        assert.equal(
          (await stagingAccessGate(downstream, () => now).fetch(request(), env, {})).status,
          401,
        );
      await h.restart();
      env.D1_USERS = h.db.D1_USERS;
      assert.equal(
        (await stagingAccessGate(downstream, () => now).fetch(request(), env, {})).status,
        429,
      );
      await h.db.D1_USERS.prepare('DROP TABLE app_storage_staging_access').run();
      assert.equal(
        (await stagingAccessGate(downstream, () => now).fetch(request(), env, {})).status,
        503,
      );
    } finally {
      await h.close();
    }
  },
);
