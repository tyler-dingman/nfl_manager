import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
let js: string, css: string;
test.beforeAll(async () => {
  const r = await build({
    entryPoints: ['tests/mobile/fixtures/research-overview.tsx'],
    bundle: true,
    write: false,
    outfile: 'overview.js',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'preview',
        setup(b) {
          b.onResolve({ filter: /^next\/font\/google$/ }, () => ({
            path: 'font',
            namespace: 'mock',
          }));
          b.onLoad({ filter: /font/, namespace: 'mock' }, () => ({
            contents: 'export const Barlow_Condensed=()=>({variable:"barlow-font"});',
          }));
          b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'mock' }));
          b.onLoad({ filter: /image/, namespace: 'mock' }, () => ({
            contents:
              'import React from "react";export default function Image({unoptimized,fill,...props}){return <img {...props}/>}',
            loader: 'jsx',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  js = r.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css = r.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
  css += `@font-face{font-family:Barlow;src:url(data:font/ttf;base64,${readFileSync('apps/mobile/assets/fonts/BarlowCondensed-ExtraBold.ttf').toString('base64')})}.barlow-font{--font-front-office-barlow:Barlow}`;
});
async function mount(page: any, width: number, team = 'KC', state = '') {
  await page.setViewportSize({ width, height: 1100 });
  await page.route('https://overview.test/**', (r: any) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    }),
  );
  await page.route('**/*.svg', (r: any) =>
    r.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="50"><circle cx="30" cy="25" r="20" fill="#274f45"/></svg>',
    }),
  );
  await page.goto(`https://overview.test/?team=${team}&state=${state}`);
  await page.addStyleTag({
    content: `*{box-sizing:border-box}body{margin:0;background:#00141e;color:white;font-family:Arial}${css}`,
  });
  await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}};' + js });
}
for (const team of ['KC', 'SEA'])
  for (const width of [390, 768, 1536])
    test(`${team} Overview order and interactions at ${width}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await mount(page, width, team);
      const dashboard = page.locator('[data-score-dashboard]');
      await expect(dashboard.getByText('37', { exact: true })).toBeVisible();
      await expect(dashboard.getByText('LOW confidence', { exact: true })).toBeVisible();
      await expect(dashboard.getByText('7/7 UNDER', { exact: true })).toBeVisible();
      await expect(
        page.getByText(/Shadow model awaiting|table still uses|Evidence and confidence limits/),
      ).toHaveCount(0);
      const body = page.locator('[data-research-body]');
      if (width <= 850) {
        const boxes = await page
          .locator(
            '[data-overview-order="score"],[data-overview-order="pick"],[data-overview-order="why"],[data-overview-order="tiles"],[data-overview-order="rail"],[data-overview-order="chart"]',
          )
          .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().top));
        expect(boxes).toEqual([...boxes].sort((a, b) => a - b));
      }
      await expect(page.getByText('Weather', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Projected Pace', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: `/tmp/overview-${team}-${width}.png` });
      await page.getByRole('button', { name: 'L5', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Last 5 Games' })).toBeVisible();
      await page.getByRole('button', { name: /^Matchup vs/ }).click();
      await expect(page.getByRole('tab', { name: 'Matchup', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByRole('button', { name: /Add to parlay/i }).click();
      await expect(page.getByRole('button', { name: /Added/i })).toBeVisible();
      expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Close player research' }).click();
      await expect(page.getByText('Closed', { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
for (const state of ['loading', 'error', 'empty', 'stable'])
  test(`Overview ${state} state`, async ({ page }) => {
    await mount(page, 390, 'SEA', state);
    if (state === 'loading')
      await expect(page.getByRole('status')).toHaveText('Loading player research…');
    if (state === 'error')
      await expect(page.getByRole('alert')).toContainText('could not be loaded');
    if (state === 'empty') await expect(page.getByText('No pick available')).toBeVisible();
    if (state === 'stable') {
      await expect(page.getByText('Role change detected', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Historical performance is not model confidence.')).toBeVisible();
    }
  });
