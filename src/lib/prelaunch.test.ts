import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { issuePreviewToken, PREVIEW_COOKIE, verifyPreviewToken } from './prelaunch';
import { middleware } from '../middleware';

function configure(enabled: boolean) {
  process.env.PRELAUNCH_MODE = enabled ? 'true' : 'false';
  process.env.PRELAUNCH_PASSWORD = 'unit-test-password';
  process.env.PRELAUNCH_SESSION_SECRET = 'unit-test-signing-secret-that-is-different';
}

test('preview token is signed, expires, and never contains the password', async () => {
  configure(true);
  const now = Date.now();
  const token = await issuePreviewToken(now);
  assert.equal(token.includes(process.env.PRELAUNCH_PASSWORD!), false);
  assert.equal(await verifyPreviewToken(token, now), true);
  assert.equal(await verifyPreviewToken(`${token}tampered`, now), false);
  assert.equal(await verifyPreviewToken(token, now + 8 * 24 * 60 * 60 * 1000), false);
});

test('prelaunch middleware hides pages and does not broadly expose APIs', async () => {
  configure(true);
  const page = await middleware(new NextRequest('https://downdistance.com/the-beat'));
  assert.equal(page.status, 307);
  assert.match(page.headers.get('location') ?? '', /\/preview\?next=%2Fthe-beat/);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const api = await middleware(new NextRequest('https://downdistance.com/api/commerce/catalog'));
  assert.equal(api.status, 401);
});

test('Stripe webhook bypasses the gate but protected admin still needs preview access', async () => {
  configure(true);
  const webhook = await middleware(
    new NextRequest('https://downdistance.com/api/commerce/stripe/webhook', { method: 'POST' }),
  );
  assert.equal(webhook.headers.get('x-middleware-next'), '1');

  const admin = await middleware(new NextRequest('https://downdistance.com/admin/commerce'));
  assert.equal(admin.status, 307);
});

test('valid preview cookie grants navigation and disabling prelaunch restores normal access', async () => {
  configure(true);
  const token = await issuePreviewToken();
  const allowed = await middleware(
    new NextRequest('https://downdistance.com/the-beat', {
      headers: { cookie: `${PREVIEW_COOKIE}=${token}` },
    }),
  );
  assert.equal(allowed.headers.get('x-middleware-next'), '1');
  assert.equal(allowed.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  configure(false);
  const launched = await middleware(new NextRequest('https://downdistance.com/the-beat'));
  assert.equal(launched.headers.get('x-middleware-next'), '1');
  assert.equal(launched.headers.get('x-robots-tag'), null);
});

test('robots and metadata are conditional and preview page contains no application content', () => {
  const robots = readFileSync('src/app/robots.ts', 'utf8');
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  const preview = readFileSync('src/app/preview/page.tsx', 'utf8');
  assert.match(robots, /disallow: '\/'/);
  assert.match(robots, /allow: '\/'/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  assert.match(layout, /noarchive/);
  assert.doesNotMatch(preview, /The Beat|Film Room|Crew|Merch|team data/i);
});
