import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePage } from './redirect-validation.mjs';
const base = 'https://staging.example';
const html = () =>
  new Response('<html><body>Sign in <input type="password"></body></html>', {
    headers: { 'content-type': 'text/html' },
  });
const run = (request, applicationAuthenticated = false) =>
  validatePage({ base, path: '/', request, applicationAuthenticated });
test('signed-out app redirect followed to same-origin login HTML', async () => {
  let calls = 0;
  const result = await run(async (url) =>
    ++calls === 1
      ? new Response(null, { status: 307, headers: { location: '/login?next=%2F' } })
      : html(),
  );
  assert.equal(calls, 2);
  assert.equal(result.finalPath, '/login');
});
test('authenticated HTML succeeds', async () =>
  assert.equal((await run(async () => html(), true)).finalPath, '/'));
for (const [name, request, authenticated] of [
  [
    'untrusted origin',
    async () =>
      new Response(null, {
        status: 307,
        headers: { location: 'https://evil.example/login?next=/' },
      }),
  ],
  [
    'protocol relative origin',
    async () =>
      new Response(null, { status: 307, headers: { location: '//evil.example/login?next=/' } }),
  ],
  [
    'unexpected destination',
    async () => new Response(null, { status: 307, headers: { location: '/preview?next=/' } }),
  ],
  [
    'incorrect next',
    async () => new Response(null, { status: 307, headers: { location: '/login?next=/profile' } }),
  ],
  ['missing destination', async () => new Response(null, { status: 307 })],
  ['loop', async () => new Response(null, { status: 307, headers: { location: '/login?next=/' } })],
  ['signed-out protected content success is unauthorized', async () => html()],
  [
    'authenticated redirect',
    async () => new Response(null, { status: 307, headers: { location: '/login?next=/' } }),
    true,
  ],
  ['forbidden response', async () => new Response('Denied', { status: 403 })],
  [
    'API body cannot count as HTML',
    async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    true,
  ],
  [
    'missing login UI',
    async () => new Response('<html>hello</html>', { headers: { 'content-type': 'text/html' } }),
  ],
])
  test(name, async () => assert.rejects(run(request, authenticated)));

test('client rendered login payload accepted without claiming browser render', async () => {
  let n = 0;
  await run(async () =>
    ++n === 1
      ? new Response(null, { status: 307, headers: { location: '/login?next=/' } })
      : new Response(
          '<html><script src="/_next/static/chunks/app/login/page-abcdef.js"></script></html>',
          { headers: { 'content-type': 'text/html' } },
        ),
  );
});

test('redirect hop budget is enforced', async () => {
  await assert.rejects(
    validatePage({
      base,
      path: '/',
      applicationAuthenticated: false,
      maxHops: 0,
      request: async () =>
        new Response(null, { status: 307, headers: { location: '/login?next=/' } }),
    }),
    /Too many redirects/,
  );
});
