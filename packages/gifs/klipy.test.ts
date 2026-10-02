import test from 'node:test';
import assert from 'node:assert/strict';
import { createKlipyProvider, normalizeKlipy } from './klipy';
import { gifReference, klipyMediaUrl } from './index';
import { validateMessage } from '../huddle/message';
const rendition = (name: string) => ({
  url: `https://static.klipy.com/test/${name}?delivery=keep`,
  width: 220,
  height: 124,
});
const fixture = {
  slug: 'football-celebration',
  title: 'Football celebration',
  file: {
    sm: { gif: rendition('small.gif'), jpg: rendition('still.jpg') },
    xs: { gif: rendition('tiny.gif') },
  },
};
test('normalizes lightweight GIF renditions without rewriting delivery URLs', () => {
  const g = normalizeKlipy(fixture);
  assert.equal(g.mediaUrl, fixture.file.sm.gif.url);
  assert.equal(g.previewUrl, fixture.file.xs.gif.url);
  assert.equal(g.aspectRatio, 220 / 124);
  assert.equal(g.attribution, 'Powered by KLIPY');
});
test('rejects injected media URLs and retains only provider references', () => {
  for (const url of [
    'https://evil.example/x.gif',
    'https://static.klipy.com.evil.example/x',
    'javascript:alert(1)',
    'https://user:pass@static.klipy.com/x',
    'http://static.klipy.com/x',
  ])
    assert.throws(() => klipyMediaUrl(url));
  assert.throws(() =>
    gifReference({ mediaType: 'gif', provider: 'klipy', providerMediaId: '../../evil' }),
  );
  assert.deepEqual(
    gifReference({
      mediaType: 'gif',
      provider: 'klipy',
      providerMediaId: 'football',
      mediaUrl: 'https://evil.example/x',
    }),
    { mediaType: 'gif', provider: 'klipy', providerMediaId: 'football' },
  );
});
test('existing message model accepts GIF-only and text+GIF and rejects empty/oversized payloads', () => {
  const media = { mediaType: 'gif', provider: 'klipy', providerMediaId: 'football' };
  assert.equal(validateMessage({ body: '', media }).body, '');
  assert.equal(validateMessage({ body: ' LETS GO ', media }).body, 'LETS GO');
  assert.throws(() => validateMessage({ body: '' }));
  assert.throws(() => validateMessage({ body: 'x'.repeat(1001), media }));
  assert.throws(() => validateMessage({ body: 'hello', media: { provider: 'other' } }));
});
test('direct client search/trending pagination and item resolution use bounded requests', async () => {
  const calls: string[] = [];
  const p = createKlipyProvider('test-app-key', async (url) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({ result: true, data: { data: [fixture], has_next: true } }),
    );
  });
  assert.equal((await p.trending()).cursor, '2');
  await p.search('lets go', '2');
  assert.equal((await p.getById(fixture.slug))?.id, fixture.slug);
  const u = new URL(calls[1]);
  assert.equal(u.hostname, 'api.klipy.com');
  assert.equal(u.searchParams.get('q'), 'lets go');
  assert.equal(u.searchParams.get('per_page'), '20');
  assert.equal(u.searchParams.get('page'), '2');
  assert.equal(u.searchParams.get('content_filter'), 'high');
  assert.ok(calls[2].includes('slugs=football-celebration'));
});
test('configuration, provider failures and unsupported ads fail cleanly', async () => {
  await assert.rejects(createKlipyProvider(undefined).trending(), /not configured/);
  await assert.rejects(
    createKlipyProvider('test', async () => new Response('', { status: 429 })).trending(),
    /busy/,
  );
  await assert.rejects(
    createKlipyProvider('test', async () => new Response('', { status: 500 })).trending(),
    /load GIFs/,
  );
  assert.throws(() => normalizeKlipy({ type: 'ad' }), /ad-free/);
});
test('search can be cancelled before an outdated result replaces the grid', async () => {
  const p = createKlipyProvider(
    'test',
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  const c = new AbortController();
  const request = p.search('old', undefined, c.signal);
  c.abort();
  await assert.rejects(request, /Aborted/);
});
