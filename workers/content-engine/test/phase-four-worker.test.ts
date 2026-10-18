import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { harness } from './harness';
import { publicCacheKey, cachePublicResponse } from '../../web/public-cache';
test('actual workerd supports bounded gzip and immutable application reads', async () => {
  const built = await build({
    stdin: {
      contents: `import {encodeObject,decodeObject} from '../../../packages/storage/codec';import{digest,utf8}from'../../../packages/storage/core';export default{async fetch(){const raw=utf8.encode('Football'.repeat(20000));const packed=await encodeObject(raw);const decoded=await decodeObject(packed,await digest(raw));return Response.json({logical:raw.length,physical:packed.length,verified:decoded.length===raw.length})}};`,
      resolveDir: new URL('../test/', import.meta.url).pathname,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
  });
  const h = await harness(false, true, 999, built.outputFiles[0].text);
  try {
    const response = await h.mf.dispatchFetch('http://local.invalid/');
    assert.equal(response.status, 200);
    const result = (await response.json()) as any;
    assert(result.verified);
    assert(result.physical < result.logical / 100);
  } finally {
    await h.close();
  }
});
test('public cache excludes credentials, personalized routes, cookies and private responses', async () => {
  const url = 'https://local.invalid/api/parlay-lab/events';
  assert(publicCacheKey(new Request(url), 'phase4'));
  for (const headers of [{ cookie: 'user=a' }, { authorization: 'Bearer owner' }] as Record<
    string,
    string
  >[])
    assert.equal(publicCacheKey(new Request(url, { headers }), 'phase4'), null);
  assert.equal(
    publicCacheKey(new Request('https://local.invalid/api/user/saved-content'), 'phase4'),
    null,
  );
  assert.equal(publicCacheKey(new Request(url + '?user=a'), 'phase4'), null);
  let puts = 0;
  const cache = {
      put: async () => {
        puts++;
      },
    } as any,
    key = publicCacheKey(new Request(url), 'phase4')!;
  for (const response of [
    new Response('private', { headers: { 'cache-control': 'private, no-store' } }),
    new Response('cookie', { headers: { 'set-cookie': 'user=a' } }),
    new Response('error', { status: 503 }),
  ])
    assert.equal(await cachePublicResponse(cache, key, response), false);
  assert(await cachePublicResponse(cache, key, Response.json({ events: [], asOf: null })));
  assert.equal(puts, 1);
});
