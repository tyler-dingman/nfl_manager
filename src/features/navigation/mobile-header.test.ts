import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const menu = readFileSync(
  new URL('../../components/mobile-site-menu.tsx', import.meta.url),
  'utf8',
);
const header = readFileSync(
  new URL('../../components/main-site-header.tsx', import.meta.url),
  'utf8',
);
const shell = readFileSync(
  new URL('../../components/site-header-shell.tsx', import.meta.url),
  'utf8',
);

test('mobile header order is logo, search, notifications, menu', () => {
  const logo = header.indexOf('SiteHeaderLogo');
  const search = header.indexOf('aria-label="Search"');
  const notifications = header.indexOf('<NotificationCenter');
  const hamburger = header.indexOf('<MobileSiteMenu');
  assert.ok(logo < search && search < notifications && notifications < hamburger);
});

test('team and account controls are desktop-only in the header', () => {
  assert.match(header, /xl:flex/);
  assert.match(header, /hidden xl:block/);
  assert.match(menu, /Your team/i);
  assert.match(menu, /Change team/i);
  assert.match(menu, /Account/i);
  assert.match(menu, /Profile/i);
  assert.match(menu, /Settings/i);
  assert.match(menu, /Sign out/i);
});

test('drawer is bounded, modal, keyboard closable, and mobile shell can fit 320px', () => {
  assert.match(menu, /w-\[min\(88vw,380px\)\]/);
  assert.match(menu, /aria-modal="true"/);
  assert.match(menu, /event\.key === 'Escape'/);
  assert.match(menu, /event\.key !== 'Tab'/);
  assert.match(shell, /min-w-0/);
  assert.match(shell, /w-28/);
  assert.match(shell, /gap-2/);
});
