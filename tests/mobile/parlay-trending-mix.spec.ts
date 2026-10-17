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
  test(`Standard and Alt discovery persistence for ${team}`, async ({ page }) => {
    const markets = ['main', 'alternate'].flatMap((lineType) =>
      Array.from({ length: 15 }, (_, i) => ({
        id: `${lineType}${i}`,
        normalizedKey: `${lineType}${i}`,
        eventId: 'event',
        playerId: `${lineType}${i}`,
        playerName: `${lineType} Player ${i}`,
        teamId: team,
        position: 'QB',
        marketType: 'PASSING_YARDS',
        statId: 'passing_yards',
        period: 'game',
        side: 'OVER',
        line: 200.5 - i * 5,
        lineType,
        odds: lineType === 'main' ? -110 : -200 - i * 50,
        sportsbook: 'FANDUEL',
        available: true,
        trend: {
          trendScore: 94 - i,
          scoreVersion: 'v2',
          projection: {
            projection: 230,
            recommendation: 'OVER',
            estimatedProbability: 0.85,
            pushProbability: 0,
            dataQuality: { reliability: 0.8, freshness: 1, currentRoleKnown: true },
            roleConfidence: 'MEDIUM',
            reasons: ['Current workload estimate'],
          },
          last10: { games: 10, hits: 8, hitRate: 80 },
          last5: { games: 5, hits: 4, hitRate: 80 },
          gameLog: [],
          streakLength: 0,
          streakType: null,
        },
      })),
    );
    await page.route('**/api/**', (r) =>
      r.fulfill({ json: { markets: [], events: [], movements: [] } }),
    );
    await page.route('**/api/parlay-lab/props?**', (r) =>
      r.fulfill({
        json: queryPropCatalog(
          markets as unknown as HomeMarket[],
          [
            { id: 'event', homeTeamId: team, awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
          ] as OddsEvent[],
          new URL(r.request().url()).searchParams,
        ),
      }),
    );
    await page.route('https://trending.test/**', (r) =>
      new URL(r.request().url()).pathname.startsWith('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body:
              '<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button{background:transparent}body{margin:0;font-family:Arial;--team-primary-on-dark:#ff123e;--team-secondary-on-dark:#ffbe00}' +
              css +
              '</style><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};window.__markets=' +
              JSON.stringify(markets) +
              ';</script><script>' +
              js.replaceAll('</script', '<\/script') +
              '</script>',
          }),
    );
    await page.setViewportSize({ width: 1536, height: 1000 });
    await page.goto(`https://trending.test/?team=${team}`);
    const rows = page.locator('.lab-props tbody tr');
    await expect(rows.first()).toContainText('main Player 0');
    await expect(page.locator('.lab-right-rail').getByText('Next Game')).toHaveCount(0);
    await expect(page.locator('.lab-right-rail').getByText('Lab Score Guide')).toHaveCount(0);
    const info = page.getByRole('button', { name: 'Open Lab Score Guide', exact: true });
    await info.click();
    await expect(page.getByRole('dialog', { name: 'Lab Score Guide' })).toBeVisible();
    await expect(page.getByText('95–99 · EXCEPTIONAL', { exact: true })).toBeVisible();
    await expect(page.getByText('0–49 · POOR', { exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/lab-score-guide-${team}.png` });
    await page.keyboard.press('Escape');
    await expect(info).toBeFocused();
    await expect(rows.first()).toContainText('main Player 0');

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search players' });
    await search.fill('  MAIN player 14  ');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('main Player 14');
    await search.fill('no-such-player');
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('No players match your search', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Clear player search' }).click();
    await expect(rows).toHaveCount(12);

    await expect(page.getByRole('checkbox', { name: 'Alt Lines' })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'Alt Lines' }).check();
    await expect(rows.first()).toContainText('main Player 0');
    await page.getByRole('combobox', { name: 'Max Odds', exact: true }).selectOption('-400');
    await expect(rows).toHaveCount(12);
    await page.getByRole('checkbox', { name: 'My Team Only' }).check();
    await expect(page.getByRole('checkbox', { name: 'Alt Lines' })).toBeChecked();
    await page.goto(`https://trending.test/?team=${team}&screen=home`);
    await expect(page.getByRole('checkbox', { name: 'Alt Lines' })).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Max Odds', exact: true })).toHaveValue('-400');
    await expect(rows).toHaveCount(5);
    await page.reload();
    await expect(rows.first()).toContainText('main Player 0');
    await page.getByRole('checkbox', { name: 'Alt Lines' }).uncheck();
    await expect(page.getByRole('combobox', { name: 'Max Odds', exact: true })).toHaveCount(0);
    await expect(rows.first()).toContainText('main Player 0');
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByRole('checkbox', { name: 'Alt Lines' }).check();
    await page.getByRole('button', { name: 'Max Odds', exact: true }).click();
    await page.getByRole('button', { name: '-200', exact: true }).click();
    await expect(rows).toHaveCount(5);
    await page.getByRole('button', { name: 'Open Lab Score Guide', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'Lab Score Guide' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Lab Score Guide', exact: true }).click();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await search.fill('alternate Player 0');
    await expect(rows).toHaveCount(1);
    await expect(search).toBeVisible();
    await page.screenshot({ path: `/tmp/prop-search-${team}.png` });
  });
