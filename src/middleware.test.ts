import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { issuePreviewToken } from './lib/prelaunch';

test('preview gate lets automation reach route auth while protecting other routes', async () => {
  const previous = process.env.PRELAUNCH_MODE;
  process.env.PRELAUNCH_MODE = 'true';
  try {
    for (const path of [
      '/api/automation/content',
      '/api/automation/content/global',
      '/api/automation/three-and-out?action=generate',
      '/api/automation/three-and-out?action=deliver',
    ]) {
      const response = await middleware(
        new NextRequest(`https://example.com${path}`, { method: 'POST' }),
      );
      assert.equal(response.headers.get('x-middleware-next'), '1', path);
    }
    for (const path of [
      '/api/automation/unknown',
      '/api/automation/three-and-out/extra',
      '/api/front-office/events',
    ]) {
      const response = await middleware(new NextRequest(`https://example.com${path}`));
      assert.equal(response.status, 401, path);
      assert.equal((await response.json()).error, 'Private preview access required.');
    }
    const page = await middleware(new NextRequest('https://example.com/front-office'));
    assert.equal(new URL(page.headers.get('location')!).pathname, '/preview');
  } finally {
    if (previous === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = previous;
  }
});

test('application pages require a real session and preserve the destination', async () => {
  const previous = process.env.PRELAUNCH_MODE;
  process.env.PRELAUNCH_MODE = 'false';
  try {
    for (const path of [
      '/',
      '/the-beat',
      '/watch',
      '/front-office',
      '/trivia',
      '/parlay-lab/players?team=KC',
      '/account',
    ]) {
      const response = await middleware(new NextRequest(`https://example.com${path}`));
      const destination = new URL(response.headers.get('location')!);
      assert.equal(destination.pathname, '/login');
      assert.equal(destination.searchParams.get('next'), path);
    }
    for (const path of [
      '/login',
      '/api/auth/social/google/start',
      '/api/auth/social/google/callback',
      '/merch',
      '/sitemap.xml',
      '/assets/example.png',
    ]) {
      const response = await middleware(new NextRequest(`https://example.com${path}`));
      assert.equal(response.headers.get('x-middleware-next'), '1', path);
    }
  } finally {
    if (previous === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = previous;
  }
});

test('passing the site password alone does not authenticate an application user', async () => {
  const previous = process.env.PRELAUNCH_MODE;
  const previousSecret = process.env.PRELAUNCH_SESSION_SECRET;
  process.env.PRELAUNCH_MODE = 'true';
  process.env.PRELAUNCH_SESSION_SECRET = 'test-preview-secret';
  try {
    const response = await middleware(
      new NextRequest('https://example.com/', {
        headers: { cookie: `dnd_preview_access=${await issuePreviewToken()}` },
      }),
    );
    assert.equal(new URL(response.headers.get('location')!).pathname, '/login');
    for (const path of ['/login', '/api/auth/me', '/api/auth/social/google/callback']) {
      const response = await middleware(new NextRequest(`https://example.com${path}`));
      assert.equal(response.headers.get('x-middleware-next'), '1');
    }
  } finally {
    if (previous === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = previous;
    if (previousSecret === undefined) delete process.env.PRELAUNCH_SESSION_SECRET;
    else process.env.PRELAUNCH_SESSION_SECRET = previousSecret;
  }
});

test('session endpoint controls access, including revoked sessions and lookup failures', async () => {
  const previous = process.env.PRELAUNCH_MODE;
  const originalFetch = globalThis.fetch;
  process.env.PRELAUNCH_MODE = 'false';
  const request = () =>
    new NextRequest('https://example.com/parlay-lab', {
      headers: { cookie: 'dd_session=opaque-session' },
    });
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://example.com/api/auth/me');
      assert.equal(
        (options?.headers as Record<string, string>).cookie,
        'dd_session=opaque-session',
      );
      assert.equal(options?.cache, 'no-store');
      return Response.json({ ok: true, user: { id: 'valid-user' } });
    };
    for (let refresh = 0; refresh < 2; refresh++) {
      assert.equal((await middleware(request())).headers.get('x-middleware-next'), '1');
    }
    globalThis.fetch = async () => Response.json({ ok: false, user: null }, { status: 401 });
    assert.equal(
      new URL((await middleware(request())).headers.get('location')!).pathname,
      '/login',
    );
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
    assert.equal((await middleware(request())).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = previous;
  }
});
