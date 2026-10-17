import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js: string, css: string;
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
  test(`dedicated ${team} slip adds, removes, persists, saves, exports and scrolls`, async ({
    page,
  }) => {
    let saved: any[] = [];
    await page.route('**/api/user/saved-content', async (r) => {
      if (r.request().method() === 'POST') {
        saved.push(r.request().postDataJSON());
        await r.fulfill({ json: { ok: true } });
      } else await r.fulfill({ json: { items: saved } });
    });
    await page.route('https://slip.test/**', (r) =>
      r.request().url().includes('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#00141e;font-family:Arial;--lab-accent:${team === 'SEA' ? '#69be28' : '#e31837'}}button{cursor:pointer}button,a{color:white}${css}</style><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${js}</script>`,
          }),
    );
    await page.setViewportSize({ width: 1400, height: 850 });
    await page.goto('https://slip.test');
    await expect(page.getByText('Build Your Parlay')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add first' }).click();
    await page.getByRole('button', { name: 'Add first' }).click();
    await expect(page.getByRole('heading', { name: 'My Parlay (1)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add second' }).click();
    await expect(page.getByRole('heading', { name: 'My Parlay (2)', exact: true })).toBeVisible();
    await expect(page.getByText('+125', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Open in/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Actions & details' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved to your account');
    expect(saved[0].metadata.play.selections[0].trend.trendScore).toBe(84);
    await page.getByRole('tab', { name: 'Saved', exact: true }).click();
    await expect(page.getByText('2 Leg Parlay · +125')).toBeVisible();
    await page.getByRole('tab', { name: 'Parlay', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save Image', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
    await page.getByRole('link', { name: 'Navigate', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My Parlay (2)', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await expect(page.getByRole('heading', { name: 'My Parlay (2)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Player 0', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My Parlay (1)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add long parlay' }).click();
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
    const scroll = await page
      .getByRole('tabpanel')
      .evaluate((e) => e.scrollHeight > e.clientHeight);
    expect(scroll).toBe(true);
    await page.screenshot({ path: '/tmp/parlay-slip-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /My Parlay \(16\).*Expand/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: '/tmp/parlay-slip-mobile.png' });
  });
