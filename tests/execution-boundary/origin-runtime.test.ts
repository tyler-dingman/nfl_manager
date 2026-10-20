import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFixture, publicOrigin } from './fixture';
import { listen, close } from '../render-staging/fixture';
import {
  createNodeOrigin,
  RUNTIME_OBSERVATION_PATH,
} from '../../src/server/node-staging/origin-server';
import { signOriginRequest, ORIGIN_HEADER } from '../../packages/security/origin-assertion';
test('origin response caching is private and runtime observations require a separate operator audience', async () => {
  const f = await nativeFixture(),
    configuration = {
      publicOrigin,
      audience: 'dd-render-staging',
      secret: 'synthetic-origin-observation-private-secret-independent-64-characters-only',
    };
  const server = createNodeOrigin({
    configuration,
    bindings: f.bindings,
    env: {},
    api: {
      fetch: async () =>
        new Response('private API', { headers: { 'cache-control': 'public,max-age=3600' } }),
    },
    next: async (_req, res) => {
      res.writeHead(200, { 'Cache-Control': 'public,max-age=31536000' });
      res.end('private asset');
    },
  });
  const url = await listen(server);
  const signed = async (path: string, audience = configuration.audience) => {
    const s = await signOriginRequest(new Request(publicOrigin + path), {
      ...configuration,
      audience,
    });
    return fetch(url + path, { headers: { [ORIGIN_HEADER]: s.assertion } });
  };
  try {
    for (const path of ['/api/auth/me', '/_next/static/synthetic.js']) {
      const r = await signed(path);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      assert.equal((await fetch(url + path)).status, 403);
    }
    assert.equal((await fetch(url + RUNTIME_OBSERVATION_PATH)).status, 403);
    assert.equal((await signed(RUNTIME_OBSERVATION_PATH)).status, 403);
    const r = await signed(RUNTIME_OBSERVATION_PATH, configuration.audience + '-runtime-observer');
    assert.equal(r.status, 200);
    const data = await r.json();
    assert(data.rssBytes > 0);
    assert(data.processCpuUserUs >= 0);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
  } finally {
    await close(server);
    await f.close();
  }
});
