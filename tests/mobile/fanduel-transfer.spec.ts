import { readFile } from 'node:fs/promises';
import { fixtureProposal } from './fixtures/transfer-proposals';
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js: string, css: string;
test.beforeEach(async ({ page }) => {
  await page.route('**/assets/sportsbooks/*', async (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop()!;
    if (!['fanduel_white.svg', 'draftkings_logo.png'].includes(name)) return r.abort();
    return r.fulfill({
      contentType: name.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
      body: await readFile(`public/assets/sportsbooks/${name}`),
    });
  });
});
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/parlay-slip.tsx'],
    bundle: true,
    write: false,
    outfile: 'slip.js',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'image',
        setup(b) {
          b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'preview' }));
          b.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({
            loader: 'jsx',
            resolveDir: process.cwd(),
            contents:
              'import React from "react";export default function Image({unoptimized,fill,...props}){return <img {...props}/>;}',
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
});
for (const team of ['KC', 'SEA'])
  test(`FanDuel ${team}: explicit generation, cancellation, failure, blocked navigation and stale slip`, async ({
    page,
  }) => {
    let starts = 0,
      polls = 0,
      mode = 'pending';
    await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { books: ['fanduel'] } });
      const b = r.request().postDataJSON();
      if (b.action === 'preview')
        return r.fulfill({
          json: { proposals: [fixtureProposal(b.ids, 'fanduel')] },
        });
      if (b.action === 'start') {
        starts++;
        expect(Object.keys(b).sort()).toEqual(['action', 'approved', 'sportsbook', 'token']);
        expect(b.sportsbook).toBe('fanduel');
        expect(b.approved).toBe(false);
      } else polls++;
      return r.fulfill({
        json: {
          id: 'fixture-job',
          status:
            mode === 'complete' && b.action === 'poll'
              ? 'complete'
              : mode === 'failed'
                ? 'failed'
                : 'pending',
          ...(mode === 'complete'
            ? {
                url: 'https://gambly.com/deeplink/deeplink-cache-fixture?utm_campaign=downanddistance',
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              }
            : {}),
          ...(mode === 'failed'
            ? { error: 'Unable to prepare this FanDuel slip. Your parlay has been preserved.' }
            : {}),
        },
      });
    });
    await page.route('https://slip.test/**', (r) =>
      r.request().url().includes('/api/') || r.request().url().includes('/assets/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#00141e;color:white;font-family:Arial;--lab-accent:${team === 'SEA' ? '#69be28' : '#e31837'}}button,a{color:inherit}${css}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
          }),
    );
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.goto('https://slip.test');
    await page.getByRole('button', { name: 'Add first', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel(/FanDuel · Estimated odds/)).toBeVisible();
    expect(starts).toBe(0);
    await expect(page.getByLabel('FanDuel region')).toHaveCount(0);
    await page.evaluate(() => {
      window.open = (() => null) as typeof window.open;
    });
    const openedPages: string[] = [];
    page.on('popup', (popup) => openedPages.push(popup.url()));
    await page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Preparing Your FanDuel Slip...' }),
    ).toBeDisabled();
    await expect(
      page.getByText('Matching your selections. This usually takes 10–20 seconds.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions & details' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await expect(page.getByRole('button', { name: 'Save Image', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add second', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel wait' }).click();
    expect(openedPages).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
    const pollsAtCancel = polls;
    await page.waitForTimeout(2300);
    expect(polls).toBe(pollsAtCancel);
    expect(starts).toBe(1);
    mode = 'failed';
    await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
    await expect(page.getByRole('alert')).toContainText('preserved');
    await expect(page.getByRole('heading', { name: 'My Parlay (1)', exact: true })).toBeVisible();
    mode = 'complete';
    await page
      .context()
      .route('https://gambly.com/**', (r) =>
        r.fulfill({ contentType: 'text/html', body: 'Fixture sportsbook destination' }),
      );
    await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
    const link = page.getByRole('link', { name: 'Continue to FanDuel ↗' });
    await expect(
      page.getByRole('status').filter({ hasText: 'Your FanDuel Slip Is Ready.' }),
    ).toBeVisible();
    expect(openedPages).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute(
      'href',
      'https://gambly.com/deeplink/deeplink-cache-fixture?utm_campaign=downanddistance',
    );
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await expect(popup.getByText('Fixture sportsbook destination')).toBeVisible();
    await popup.close();
    expect(starts).toBe(3);
    await expect(page.getByRole('button', { name: 'Save Image', exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/fanduel-${team}-desktop.png` });
    await page.getByRole('button', { name: 'Add second', exact: true }).click();
    await expect(link).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /My Parlay \(2\).*Expand/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toBeVisible();
    openedPages.length = 0;
    await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
    const fallback = page.getByRole('link', { name: 'Continue to FanDuel ↗' });
    await expect(fallback).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Your FanDuel Slip Is Ready.' }),
    ).toBeVisible();
    expect(openedPages).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
    const fallbackPopup = page.waitForEvent('popup');
    await fallback.click();
    const fallbackTab = await fallbackPopup;
    await expect(fallbackTab.getByText('Fixture sportsbook destination')).toBeVisible();
    await fallbackTab.close();
    await page.screenshot({ path: `/tmp/fanduel-${team}-mobile.png` });
  });
for (const team of ['KC', 'SEA'])
  test(`multi-book ${team}: independent availability and explicit adjusted-slip approval`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open;
    });
    let starts: any[] = [];
    let offered = 'both';
    await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
      if (r.request().method() === 'GET')
        return r.fulfill({ json: { books: ['betmgm', 'caesars', 'draftkings', 'fanduel'] } });
      const b = r.request().postDataJSON();
      if (b.action === 'preview')
        return r.fulfill({
          json: {
            proposals:
              offered === 'none'
                ? []
                : [
                    fixtureProposal(b.ids, 'draftkings'),
                    ...(offered === 'both'
                      ? [
                          fixtureProposal(b.ids, 'fanduel', true),
                          fixtureProposal(b.ids, 'caesars', true),
                          fixtureProposal(b.ids, 'betmgm'),
                        ]
                      : []),
                  ],
          },
        });
      if (b.action === 'start') starts.push(b);
      return r.fulfill({
        json: {
          id: 'job',
          status: 'complete',
          url: `https://gambly.com/deeplink/deeplink-cache-${b.sportsbook}?utm_campaign=downanddistance`,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      });
    });
    await page.route('https://slip.test/**', (r) =>
      r.request().url().includes('/api/') || r.request().url().includes('/assets/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#00141e;color:white;font-family:Arial;--lab-accent:${team === 'KC' ? '#e31837' : '#69be28'}}${css}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
          }),
    );
    await page.setViewportSize({ width: team === 'KC' ? 1400 : 390, height: 900 });
    await page.goto('https://slip.test');
    await page.getByRole('button', { name: 'Add first', exact: true }).click();
    if (team === 'SEA') await page.getByRole('button', { name: /My Parlay \(1\).*Expand/ }).click();
    const section =
      team === 'SEA'
        ? page.getByRole('dialog').getByRole('region', { name: 'Sportsbook transfers' })
        : page.getByRole('region', { name: 'Sportsbook transfers' });
    const dk = section.getByRole('button', { name: 'Open in DraftKings ↗' }),
      fd = section.getByRole('button', { name: 'Open in FanDuel ↗' });
    await expect(dk).toBeVisible();
    await expect(fd).toBeVisible();
    expect((await dk.boundingBox())!.y).toBeLessThan((await fd.boundingBox())!.y);
    const mgm = section.getByRole('button', { name: 'Open in BetMGM ↗' });
    const caesars = section.getByRole('button', { name: 'Open in Caesars ↗' });
    await expect(mgm).toBeVisible();
    await expect(caesars).toBeVisible();
    expect((await mgm.boundingBox())!.y).toBeLessThan((await caesars.boundingBox())!.y);
    expect((await caesars.boundingBox())!.y).toBeLessThan((await dk.boundingBox())!.y);
    await expect(section.getByLabel('DraftKings · Estimated odds +150')).toBeVisible();
    await fd.click();
    await expect(section.getByRole('group', { name: 'FanDuel Line Adjustment' })).toBeVisible();
    await expect(section.getByText(/Proposed:.*3.5/)).toBeVisible();
    expect(starts).toHaveLength(0);
    await section.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(starts).toHaveLength(0);
    await fd.click();
    await section.getByRole('button', { name: 'Continue with Adjustment' }).click();
    await expect(section.getByRole('link', { name: 'Continue to FanDuel ↗' })).toBeVisible();
    expect(starts).toHaveLength(1);
    expect(starts[0].approved).toBe(true);
    expect(starts[0].sportsbook).toBe('fanduel');
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('slip-fixture')!)[0].line),
    ).toBe(4.5);

    await dk.click();
    await expect(section.getByRole('link', { name: 'Continue to DraftKings ↗' })).toBeVisible();
    expect(starts[1].approved).toBe(false);
    expect(page.context().pages()).toHaveLength(1);
    await mgm.click();
    await expect(section.getByRole('link', { name: 'Continue to BetMGM ↗' })).toBeVisible();
    expect(starts[2].sportsbook).toBe('betmgm');
    await caesars.click();
    await section.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(starts).toHaveLength(3);
    await caesars.click();
    await section.getByRole('button', { name: 'Continue with Adjustment' }).click();
    await expect(section.getByRole('link', { name: 'Continue to Caesars ↗' })).toBeVisible();
    expect(starts[3].sportsbook).toBe('caesars');
    expect(starts[3].approved).toBe(true);
    await page.screenshot({ path: `/tmp/multibook-${team}.png` });
  });

test('FanDuel explicit generation: adding and refreshing do not generate; ready link is reused until expiry', async ({
  page,
}) => {
  let starts = 0;
  await page.route('**/api/parlay-lab/sportsbook-transfer', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { books: ['fanduel'] } });
    const b = r.request().postDataJSON();
    if (b.action === 'preview')
      return r.fulfill({
        json: { proposals: [fixtureProposal(b.ids, 'fanduel')] },
      });
    if (b.action === 'start') starts++;
    return r.fulfill({
      json: {
        id: 'job',
        status: 'complete',
        url: 'https://gambly.com/deeplink/deeplink-cache-ready?utm_campaign=downanddistance',
        expiresAt: new Date(Date.now() + 7000).toISOString(),
      },
    });
  });
  await page.route('https://slip.test/**', (r) =>
    r.request().url().includes('/api/') || r.request().url().includes('/assets/')
      ? r.fallback()
      : r.fulfill({
          contentType: 'text/html',
          body: `<style>${css}@media(max-width:600px){#root>div{grid-template-columns:1fr!important}}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
        }),
  );
  await page
    .context()
    .route('https://gambly.com/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: 'Ready fixture slip' }),
    );
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.goto('https://slip.test');
  await page.getByRole('button', { name: 'Add first', exact: true }).click();
  await page.getByRole('button', { name: 'Add second', exact: true }).click();
  await page.waitForTimeout(1800);
  expect(starts).toBe(0);
  await page.getByRole('button', { name: 'Actions & details' }).click();
  await expect(page.getByRole('button', { name: 'Recheck Stored Availability' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toBeEnabled();
  expect(starts).toBe(0);
  await page.evaluate(() => {
    window.open = (() => null) as typeof window.open;
  });
  await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
  const ready = page.getByRole('link', { name: 'Continue to FanDuel ↗' });
  await expect(ready).toBeVisible();
  expect(starts).toBe(1);
  expect(page.context().pages()).toHaveLength(1);
  const popupEvent = page.waitForEvent('popup');
  await ready.click();
  const popup = await popupEvent;
  await expect(popup.getByText('Ready fixture slip')).toBeVisible();
  await popup.close();
  expect(starts).toBe(1);
  await expect(ready).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1800);
  expect(starts).toBe(1);
});

test('FanDuel explicit generation: changed pending slip cannot open stale link; latest slip queues once', async ({
  page,
}) => {
  const starts: string[] = [];
  let releaseOld = false;
  await page.addInitScript(() => {
    (window as any).__opens = [];
    window.open = ((url: string) => {
      (window as any).__opens.push(url);
      return { opener: null };
    }) as typeof window.open;
  });
  await page.route('**/api/parlay-lab/sportsbook-transfer', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { books: ['fanduel'] } });
    const b = r.request().postDataJSON();
    if (b.action === 'preview')
      return r.fulfill({
        json: { proposals: [fixtureProposal(b.ids, 'fanduel')] },
      });
    if (b.action === 'start') starts.push(b.token);
    const id = b.action === 'start' ? String(starts.length) : b.id;
    const complete = id !== '1' || releaseOld;
    return r.fulfill({
      json: {
        id,
        status: complete ? 'complete' : 'pending',
        ...(complete
          ? {
              url: `https://gambly.com/deeplink/deeplink-cache-${id}?utm_campaign=downanddistance`,
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            }
          : {}),
      },
    });
  });
  await page.route('https://slip.test/**', (r) =>
    r.request().url().includes('/api/') || r.request().url().includes('/assets/')
      ? r.fallback()
      : r.fulfill({
          contentType: 'text/html',
          body: `<style>${css}@media(max-width:600px){#root>div{grid-template-columns:1fr!important}}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
        }),
  );
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.goto('https://slip.test');
  await page.getByRole('button', { name: 'Add first', exact: true }).click();
  expect(starts).toHaveLength(0);
  await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
  await expect.poll(() => starts.length).toBe(1);
  await page.getByRole('button', { name: 'Add second', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toBeVisible();
  await page.getByRole('button', { name: 'Open in FanDuel ↗' }).click();
  expect(starts).toHaveLength(1);
  releaseOld = true;
  await expect.poll(() => starts.length).toBe(2);
  await expect
    .poll(() => page.evaluate(() => (window as any).__opens))
    .toEqual(['https://gambly.com/deeplink/deeplink-cache-2?utm_campaign=downanddistance']);
  await page.waitForTimeout(1800);
  expect(starts).toHaveLength(2);
});

test('Transfer discovery failure recovers automatically without a recheck button', async ({
  page,
}) => {
  let attempts = 0;
  let offline = true;
  await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
    if (r.request().method() === 'GET') {
      attempts++;
      return offline ? r.abort('failed') : r.fulfill({ json: { books: ['fanduel'] } });
    }
    const b = r.request().postDataJSON();
    return r.fulfill({
      json:
        b.action === 'preview'
          ? { proposals: [fixtureProposal(b.ids, 'fanduel')] }
          : { id: 'fixture-job', status: 'pending' },
    });
  });
  await page.route('https://slip.test/**', (r) =>
    r.request().url().includes('/api/') || r.request().url().includes('/assets/')
      ? r.fallback()
      : r.fulfill({
          contentType: 'text/html',
          body: `<style>${css}@media(max-width:600px){#root>div{grid-template-columns:1fr!important}}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
        }),
  );
  await page.goto('https://slip.test');
  await page.getByRole('button', { name: 'Add first', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to check sportsbook transfers');
  offline = false;
  await expect(page.getByText('Direct transfer is unavailable', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recheck Stored Availability' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true })).toBeEnabled();
  expect(attempts).toBeGreaterThanOrEqual(2);
});

for (const width of [1400, 390])
  test(`stored complete-slip intersection updates automatically at ${width}px without generation`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    let mode = 'normal',
      previews = 0,
      starts = 0;
    await page.route('**/api/parlay-lab/sportsbook-transfer', (r) => {
      if (r.request().method() === 'GET')
        return r.fulfill({ json: { books: ['draftkings', 'fanduel'] } });
      const b = r.request().postDataJSON();
      if (b.action !== 'preview') {
        starts++;
        return r.fulfill({ json: { status: 'failed', error: 'Unexpected generation' } });
      }
      previews++;
      const books =
        mode === 'none' ? [] : b.ids.includes('m0') ? ['draftkings'] : ['draftkings', 'fanduel'];
      return r.fulfill({
        json: {
          proposals: books.map((book) => fixtureProposal(b.ids, book as 'draftkings' | 'fanduel')),
        },
      });
    });
    await page.route('https://slip.test/**', (r) =>
      r.request().url().includes('/api/') || r.request().url().includes('/assets/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}@media(max-width:600px){#root>div{grid-template-columns:1fr!important}}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
          }),
    );
    await page.setViewportSize({ width, height: 950 });
    await page.goto('https://slip.test');
    await page.getByRole('button', { name: 'Add first', exact: true }).click();
    if (width < 600) await page.getByRole('button', { name: /My Parlay.*Expand/ }).click();
    await expect(page.getByRole('button', { name: 'Open in DraftKings ↗' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toHaveCount(0);
    if (width < 600) await page.getByRole('button', { name: 'Close sheet', exact: true }).click();
    await page.getByRole('button', { name: 'Add second', exact: true }).click();
    if (width < 600) await page.getByRole('button', { name: /My Parlay.*Expand/ }).click();
    await expect(page.getByRole('button', { name: 'Open in DraftKings ↗' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove Player 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Open in DraftKings ↗' })).toBeEnabled();
    await expect(
      page
        .getByRole('button', { name: 'Open in DraftKings ↗' })
        .getByLabel('DraftKings · Estimated odds +150'),
    ).toContainText('Est. +150');
    await expect(
      page
        .getByRole('button', { name: 'Open in FanDuel ↗' })
        .getByLabel('FanDuel · Estimated odds -350'),
    ).toContainText('Est. -350');
    await page.getByRole('button', { name: 'Actions & details' }).click();
    mode = 'none';
    const before = previews;
    await expect(page.getByRole('button', { name: 'Recheck Stored Availability' })).toHaveCount(0);
    await expect.poll(() => previews, { timeout: 35000 }).toBeGreaterThan(before);
    await expect(page.getByRole('button', { name: /Open in (FanDuel|DraftKings)/ })).toHaveCount(0);
    await expect(
      page.getByText(/Stored odds do not support a complete slip/).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await page.waitForTimeout(1800);
    expect(starts).toBe(0);
  });

for (const book of ['draftkings', 'fanduel'] as const) {
  for (const blocked of [false, true]) {
    test(`${book} opens automatically after generation, popup blocked=${blocked}`, async ({
      page,
      context,
    }) => {
      const url = 'https://gambly.com/deeplink/deeplink-cache-auto?utm_campaign=downanddistance';
      let starts = 0;
      await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
        if (r.request().method() === 'GET') return r.fulfill({ json: { books: [book] } });
        const b = r.request().postDataJSON();
        if (b.action === 'preview')
          return r.fulfill({ json: { proposals: [fixtureProposal(b.ids, book)] } });
        starts++;
        await new Promise((resolve) => setTimeout(resolve, 300));
        return r.fulfill({
          json: {
            id: 'job',
            status: 'complete',
            url,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        });
      });
      await page.route('https://slip.test/**', (r) =>
        r.request().url().includes('/api/') || r.request().url().includes('/assets/')
          ? r.fallback()
          : r.fulfill({
              contentType: 'text/html',
              body: `<style>${css}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
            }),
      );
      await context.route('https://gambly.com/**', (r) =>
        r.fulfill({ contentType: 'text/html', body: 'Validated slip destination' }),
      );
      await page.setViewportSize({ width: 1400, height: 950 });
      await page.goto('https://slip.test');
      await page.getByRole('button', { name: 'Add first', exact: true }).click();
      if (blocked)
        await page.evaluate(() => {
          window.open = () => null;
        });
      const destination = blocked ? Promise.resolve(page) : page.waitForEvent('popup');
      await page
        .getByRole('button', {
          name: `Open in ${book === 'fanduel' ? 'FanDuel' : 'DraftKings'} ↗`,
          exact: true,
        })
        .click();
      await expect(await destination).toHaveURL(url);
      expect(starts).toBe(1);
    });
  }
}
