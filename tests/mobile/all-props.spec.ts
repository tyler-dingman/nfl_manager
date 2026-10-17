import { queryPropCatalog } from '../../packages/parlay/prop-catalog';
import type { HomeMarket, OddsEvent } from '../../packages/parlay/research';
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/trending-mix.tsx'],
    bundle: true,
    write: false,
    outfile: 'mix.js',
    external: ['/assets/*'],
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'next-preview',
        setup(b) {
          b.onResolve({ filter: /^next\/(font\/google|navigation|link|image)$/ }, (a) => ({
            path: a.path,
            namespace: 'preview',
          }));
          b.onLoad({ filter: /.*/, namespace: 'preview' }, (a) => ({
            loader: 'tsx',
            resolveDir: process.cwd(),
            contents:
              a.path === 'next/navigation'
                ? readFileSync('tests/mobile/fixtures/next-navigation-preview.ts', 'utf8')
                : a.path === 'next/font/google'
                  ? 'export const Barlow_Condensed=()=>({variable:"barlow"});'
                  : a.path === 'next/link'
                    ? 'import React from "react";export default function Link(props){return <a {...props}/>;}'
                    : 'import React from "react";export default function Image({unoptimized,fill,...props}){return <img {...props}/>;}',
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css =
    result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text +
    readFileSync('src/components/parlay-lab/dashboard.css', 'utf8');
});

for (const team of ['KC', 'SEA'])
  test(`All Props pagination, binary selections and mobile layout ${team}`, async ({ page }) => {
    const events = [
      { id: 'event', homeTeamId: team, awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
    ] as OddsEvent[];
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: `m${i}`,
      eventId: 'event',
      playerId: `p${i}`,
      playerName: `Player ${i}`,
      teamId: team,
      marketType: i === 0 ? 'TOUCHDOWNS' : 'RECEPTIONS',
      statId: i === 0 ? 'touchdowns' : 'receptions',
      period: 'game',
      line: i === 0 ? null : 3.5,
      side: i === 0 ? 'YES' : 'OVER',
      lineType: 'main',
      sportsbook: 'DRAFTKINGS',
      odds: 145,
      available: true,
    })) as HomeMarket[];
    await page.route('**/api/parlay-lab/props?**', (r) =>
      r.fulfill({ json: queryPropCatalog(rows, events, new URL(r.request().url()).searchParams) }),
    );
    await page.route('https://trending.test/**', (r) =>
      new URL(r.request().url()).pathname.startsWith('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body:
              '<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button{background:transparent}body{margin:0;font-family:Arial;--team-primary-on-dark:#ff123e;--team-secondary-on-dark:#ffbe00}' +
              css +
              '</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};window.__markets=[];</script><script>' +
              js.replaceAll('</script', '<\/script') +
              '</script>',
          }),
    );
    await page.setViewportSize({ width: 1536, height: 1000 });
    await page.goto(`https://trending.test/?team=${team}&screen=all-props`);
    const tableRows = page.locator('.lab-props tbody tr');
    await expect(tableRows).toHaveCount(12);
    await expect(page.getByText('Page 1 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Touchdowns', exact: true }).click();
    await page.getByRole('button', { name: 'Anytime TD', exact: true }).click();
    await expect(tableRows).toHaveCount(1);
    await expect(tableRows.first()).toContainText('Yes');
    await page
      .getByRole('button', { name: 'Add Player 0 Anytime TD Yes at DraftKings to parlay' })
      .click();
    expect(
      await page.evaluate(() => ({
        side: (window as any).__added.side,
        line: (window as any).__added.line,
        book: (window as any).__added.sportsbook,
      })),
    ).toEqual({ side: 'YES', line: null, book: 'DRAFTKINGS' });
    await page.getByRole('checkbox', { name: 'Alt Lines', exact: true }).check();
    await expect(tableRows).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 1000 });
    await expect(page.getByRole('searchbox', { name: 'Search players' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({ path: `/tmp/all-props-${team}.png`, fullPage: true });
    await page.getByRole('searchbox', { name: 'Search players' }).fill('nobody');
    await expect(tableRows).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(tableRows).toHaveCount(12);
  });
