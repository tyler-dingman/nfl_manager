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

for (const screen of ['all-props', 'trends'])
  test(`breadcrumb drill-down, deep links and history: ${screen}`, async ({ page }) => {
    const team = screen === 'all-props' ? 'KC' : 'SEA';
    const events = [
      { id: 'event', homeTeamId: team, awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
    ] as OddsEvent[];
    const types = [
      'PASSING_YARDS',
      'PASSING_TD',
      'PASSING_COMPLETIONS',
      'PASSING_ATTEMPTS',
      'PASSING_INTERCEPTIONS',
      'PASSING_RUSHING_YARDS',
      'PASSING_LONGEST_COMPLETION',
      'RECEIVING_YARDS',
      'RECEPTIONS',
      'RUSHING_RECEIVING_YARDS',
      'RECEIVING_LONGEST_RECEPTION',
      'TOUCHDOWNS',
    ];
    const rows = types.map((marketType, i) => ({
      id: `m${i}`,
      playerId: `p${i}`,
      playerName: `Player ${i}`,
      teamId: team,
      eventId: 'event',
      period: 'game',
      marketType,
      line: marketType === 'TOUCHDOWNS' ? null : 10.5,
      side: marketType === 'TOUCHDOWNS' ? 'YES' : 'OVER',
      lineType: 'main',
      sportsbook: 'DRAFTKINGS',
      odds: 100,
      available: true,
      trend: {
        trendScore: 85,
        projection: {
          modelScore: 80,
          projection: 20,
          estimatedProbability: 0.8,
          recommendation: 'OVER',
          dataQuality: { currentRoleKnown: true, reliability: 0.9, freshness: 1 },
        },
        last10: { hits: 8, games: 10, hitRate: 80 },
      },
    })) as HomeMarket[];
    let releaseResponse: (() => void) | undefined;
    let pauseResponse = false;
    let failResponse = false;
    let catalogRequests = 0;
    await page.route('**/api/parlay-lab/props?**', async (r) => {
      if (pauseResponse)
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
      if (failResponse) return r.fulfill({ status: 503, json: { error: 'Unavailable' } });
      catalogRequests++;
      return r.fulfill({
        json: {
          ...queryPropCatalog(rows, events, new URL(r.request().url()).searchParams),
          progress: {
            complete: catalogRequests > 1,
            loadedEvents: catalogRequests > 1 ? 2 : 1,
            totalEvents: 2,
          },
        },
      });
    });
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
    await page.setViewportSize({ width: 1536, height: 1000 });
    await page.goto(`https://trending.test/?team=${team}&screen=${screen}`);
    const nav = page.getByRole('navigation', { name: 'Prop market navigation' });
    await expect(page.getByRole('status')).toContainText('1 of 2 loaded');
    await expect(page.getByRole('table', { name: 'Player prop selections' })).toContainText(
      'Player 0',
    );
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(catalogRequests).toBe(2);

    await expect(nav.getByRole('button', { name: 'Passing', exact: true })).toBeVisible();
    await expect(page.getByLabel('Market breadcrumb')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Specific market' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Passing Yards', exact: true })).toHaveCount(0);
    const table = page.getByRole('table', { name: 'Player prop selections' });
    await expect(table).toContainText('Player 0');
    pauseResponse = true;
    await page
      .getByRole('combobox', { name: 'Sportsbook', exact: true })
      .selectOption('DRAFTKINGS');
    await expect(
      page.getByText('Updating selections… Showing previous results.', { exact: true }),
    ).toBeVisible();
    await expect(table).toContainText('Player 0');
    await expect.poll(() => !!releaseResponse).toBe(true);
    pauseResponse = false;
    releaseResponse!();
    await expect(
      page.getByText('Updating selections… Showing previous results.', { exact: true }),
    ).toHaveCount(0);
    failResponse = true;
    await page.getByRole('combobox', { name: 'Sportsbook', exact: true }).selectOption('ALL');
    await expect(page.getByRole('alert')).toContainText('Showing previous results');
    await expect(table).toContainText('Player 0');
    failResponse = false;
    await page
      .getByRole('combobox', { name: 'Sportsbook', exact: true })
      .selectOption('DRAFTKINGS');
    await page.getByRole('combobox', { name: 'Sort props', exact: true }).selectOption('score-low');
    await page.getByRole('checkbox', { name: 'Alt Lines', exact: true }).check();
    const passing = nav.getByRole('button', { name: 'Passing', exact: true });
    await passing.focus();
    await page.keyboard.press('Enter');
    await expect(nav.getByRole('button', { name: 'All Passing', exact: true })).toBeFocused();
    await expect(nav.getByRole('group', { name: 'Market categories', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Market breadcrumb')).toHaveText('All PropsPassing');
    await expect(page).toHaveURL(/category=passing/);
    await nav.getByRole('button', { name: 'Passing Yards', exact: true }).click();
    await expect(nav.getByRole('button', { name: 'Passing Yards', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page).toHaveURL(/market=passing_yards/);
    await expect(page.locator('.lab-prop-group')).toHaveCount(1);
    await page.goBack();
    await expect(nav.getByRole('button', { name: 'All Passing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.goForward();
    await expect(nav.getByRole('button', { name: 'Passing Yards', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await expect(nav.getByRole('button', { name: 'Passing Yards', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await nav.getByRole('button', { name: 'Passing TDs', exact: true }).click();
    await expect(page.locator('.lab-prop-group')).toHaveCount(1);
    await expect(page.locator('.lab-prop-group')).toContainText('Passing TDs');
    await nav.getByRole('button', { name: 'Back to all prop categories' }).click();
    await expect(nav.getByRole('group', { name: 'Market categories', exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.has('category')).toBe(false);
    expect(new URL(page.url()).searchParams.has('market')).toBe(false);
    await expect(page.getByRole('combobox', { name: 'Sportsbook', exact: true })).toHaveValue(
      'DRAFTKINGS',
    );
    await expect(page.getByRole('combobox', { name: 'Sort props', exact: true })).toHaveValue(
      'score-low',
    );
    await expect(page.getByRole('checkbox', { name: 'Alt Lines', exact: true })).toBeChecked();
    await page.setViewportSize({ width: 390, height: 1000 });
    await nav.getByRole('button', { name: 'Receiving', exact: true }).click();
    await nav.getByRole('button', { name: 'Longest Reception', exact: true }).click();
    await expect(
      nav.getByRole('button', { name: 'Longest Reception', exact: true }),
    ).toBeInViewport();
    await expect(page.getByLabel('Market breadcrumb')).toHaveText('All PropsReceiving');
    await page.screenshot({ path: `/tmp/prop-breadcrumbs-${screen}.png` });
    await nav.getByRole('button', { name: 'Back to all prop categories' }).click();
    await nav.getByRole('button', { name: 'Touchdowns', exact: true }).click();
    await nav.getByRole('button', { name: 'Anytime TD', exact: true }).click();
    await expect(page.locator('.lab-prop-group')).toHaveCount(1);
    await page
      .getByRole('button', {
        name: 'Add Player 11 Anytime TD Yes at DraftKings to parlay',
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => (window as any).__added.side)).toBe('YES');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.goto(
      `https://trending.test/?team=${team}&screen=${screen}&category=passing&market=receptions`,
    );
    await expect(nav.getByRole('button', { name: 'All Passing', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(new URL(page.url()).searchParams.has('market')).toBe(false);
  });
