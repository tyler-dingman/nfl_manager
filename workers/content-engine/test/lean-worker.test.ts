import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { harness } from './harness';
test('selected A executes inside workerd with loopback/auth guards, mirrored objects, original IDs and full payload pages', async () => {
  const compiled = await build({
    entryPoints: ['src/lean-local-worker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const h = await harness(true, true, 999, compiled.outputFiles[0].text);
  try {
    const headers = {
      authorization: 'Bearer synthetic-loopback-token-only',
      'content-type': 'application/json',
    };
    assert.equal(
      (await h.mf.dispatchFetch('http://localhost/local/document?kind=story&id=saved')).status,
      401,
    );
    assert.equal(
      (await h.mf.dispatchFetch('https://production.invalid/local/document', { headers })).status,
      403,
    );
    assert.equal(
      (await h.mf.dispatchFetch('http://localhost/local/document?kind=user', { headers })).status,
      400,
    );
    const document = {
      kind: 'story',
      id: 'saved',
      headline: 'Original',
      category: 'NEWS',
      publishedAt: 1800000000000,
      sourceId: 'source-1',
      teamIds: ['kc'],
      payload: {
        id: 'saved',
        headline: 'Original',
        publicationState: 'PUBLISHED',
        sourceId: 'source-1',
        author: 'Original reporter',
        summary: 'Exact preserved source',
      },
    };
    const post = () =>
      h.mf.dispatchFetch('http://localhost/local/document', {
        method: 'POST',
        headers,
        body: JSON.stringify(document),
      });
    assert.equal((await post()).status, 200);
    assert.equal(((await (await post()).json()) as any).changed, false);
    assert.deepEqual(
      await (
        await h.mf.dispatchFetch('http://localhost/local/document?kind=story&id=saved', { headers })
      ).json(),
      document.payload,
    );
    const page = (await (
      await h.mf.dispatchFetch('http://localhost/local/feed?kind=story&team=kc', { headers })
    ).json()) as any;
    assert.deepEqual(page.items, [document.payload]);
    const primary = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
      keys = await primary.list();
    assert.equal(keys.objects.length, 1);
    await primary.delete(keys.objects[0].key); // Synthetic corruption-recovery fixture only.
    assert.deepEqual(
      await (
        await h.mf.dispatchFetch('http://localhost/local/document?kind=story&id=saved', { headers })
      ).json(),
      document.payload,
    );
    const maximumPayload = { text: 'x'.repeat(511989) };
    assert.equal(new TextEncoder().encode(JSON.stringify(maximumPayload)).length, 512000);
    const maximum = { ...document, id: 'maximum', payload: maximumPayload };
    const accepted = await h.mf.dispatchFetch('http://localhost/local/document', {
      method: 'POST',
      headers,
      body: JSON.stringify(maximum),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(
      await (
        await h.mf.dispatchFetch('http://localhost/local/document?kind=story&id=maximum', {
          headers,
        })
      ).json(),
      maximumPayload,
    );
  } finally {
    await h.close();
  }
});
