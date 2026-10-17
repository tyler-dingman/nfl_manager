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
  test(`shared nested discovery, selection eligibility and filter persistence ${team}`, async ({
    page,
  }) => {
    const events = [
      { id: 'event', homeTeamId: team, awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
    ] as OddsEvent[];
    const trend = (score: number, eligible = true) => ({
      trendScore: score,
      projection: {
        modelScore: score,
        projection: 8,
        estimatedProbability: 0.8,
        recommendation: 'OVER',
        dataQuality: { reliability: 0.9, currentRoleKnown: eligible, freshness: 1 },
      },
      last10: { hits: 8, games: 10, hitRate: 80 },
    });
    const rows = Array.from({ length: 14 }, (_, i) => ({
      id: `main${i}`,
      eventId: 'event',
      playerId: `p${i}`,
      playerName: `Player ${i}`,
      teamId: team,
      marketType: 'RECEPTIONS',
      statId: 'receptions',
      period: 'game',
      line: 3.5,
      side: 'OVER',
      lineType: 'main',
      sportsbook: 'DRAFTKINGS',
      odds: -110,
      available: true,
      trend: trend(i === 1 ? 90 : 80),
    })) as HomeMarket[];
    rows.push(
      {
        ...rows[0],
        id: 'eligible-alt',
        line: 2.5,
        lineType: 'alternate',
        odds: -145,
        trend: trend(85) as HomeMarket['trend'],
      },
      {
        ...rows[0],
        id: 'ineligible-alt',
        line: 1.5,
        lineType: 'alternate',
        odds: -300,
        trend: trend(99, false) as HomeMarket['trend'],
      },
    );
    await page.route('**/api/parlay-lab/props?**', (r) =>
      r.fulfill({ json: queryPropCatalog(rows, events, new URL(r.request().url()).searchParams) }),
    );
    await page.route('https://trending.test/**', (r) =>
      new URL(r.request().url()).pathname.startsWith('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body:
              '<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button{background:transparent;border:0}body{margin:0;font-family:Arial;--team-primary-on-dark:#ff123e;--team-secondary-on-dark:#ffbe00}' +
              css +
              '</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};window.__markets=[];</script><script>' +
              js.replaceAll('</script', '<\/script') +
              '</script>',
          }),
    );
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto(`https://trending.test/?team=${team}&screen=all-props`);
    await expect(page.locator('.lab-prop-group')).toHaveCount(12);
    await page.getByRole('button', { name: 'Receiving', exact: true }).click();
    await page
      .getByLabel('Receiving markets')
      .getByRole('button', { name: 'Receptions', exact: true })
      .click();
    await page.getByRole('checkbox', { name: 'Alt Lines', exact: true }).check();
    await expect(page.locator('.lab-prop-group').first()).toContainText('Player 0');
    const group = page.locator('.lab-prop-group').filter({
      has: page.getByRole('button', { name: 'Expand Player 0 Receptions lines', exact: true }),
    });
    await group
      .getByRole('button', { name: 'Expand Player 0 Receptions lines', exact: true })
      .click();
    await expect(page.locator('.lab-prop-group').first().locator('tr')).toHaveCount(3);
    await page
      .getByRole('button', {
        name: 'Add Player 0 Receptions O 2.5 at DraftKings to parlay',
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => (window as any).__added.id)).toBe('eligible-alt');
    await page.screenshot({ path: `/tmp/grouped-props-desktop-${team}.png` });
    await page.goto(
      `https://trending.test/?team=${team}&screen=trends&category=receiving&market=receptions`,
    );
    await expect(page.getByLabel('Market breadcrumb')).toContainText('Receiving');
    await expect(
      page.getByLabel('Receiving markets').getByRole('button', { name: 'Receptions', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox', { name: 'Alt Lines', exact: true })).toBeChecked();
    await expect(page.locator('.lab-prop-group').first()).toContainText('Player 1');
    await expect(page.locator('.lab-spotlight-prop')).toHaveCount(3);
    await page.locator('.lab-spotlight-prop').first().click();
    expect(await page.evaluate(() => Boolean((window as any).__opened.id))).toBe(true);
    await page.setViewportSize({ width: 390, height: 1000 });
    const expand = page.getByRole('button', {
      name: 'Expand Player 0 Receptions lines',
      exact: true,
    });
    await expand.click();
    await expect(
      page.getByRole('button', {
        name: 'Add Player 0 Receptions O 2.5 at DraftKings to parlay',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Add Player 0 Receptions O 1.5 at DraftKings to parlay',
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole('button', {
        name: 'Add Player 0 Receptions O 2.5 at DraftKings to parlay',
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => (window as any).__added.line)).toBe(2.5);
    await page.locator('.lab-mobile-score-help:visible').first().getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Lab Score Guide' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Lab Score Guide' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({ path: `/tmp/grouped-props-mobile-${team}.png`, fullPage: true });
    await page
      .getByRole('button', { name: 'Collapse Player 0 Receptions lines', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Add Player 0 Receptions O 2.5 at DraftKings to parlay',
        exact: true,
      }),
    ).toHaveCount(0);
  });
