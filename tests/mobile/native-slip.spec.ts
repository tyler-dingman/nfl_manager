import { fixtureProposal } from './fixtures/transfer-proposals';
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/native-slip.jsx'],
    bundle: true,
    write: false,
    loader: { '.png': 'dataurl' },
    jsx: 'automatic',
    resolveExtensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    alias: {
      'react-native-svg': path.resolve(
        'apps/mobile/node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js',
      ),
      'react-native': path.resolve('apps/mobile/node_modules/react-native-web'),
      react: path.resolve('apps/mobile/node_modules/react'),
      'react-dom': path.resolve('apps/mobile/node_modules/react-dom'),
    },
    plugins: [
      {
        name: 'native-adapters',
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(@expo\/vector-icons|expo-file-system\/legacy|expo-sharing|react-native-safe-area-context)$|\/lib\/(auth-context|auth|large-device-storage)$/,
            },
            (a) => ({ path: a.path, namespace: 'preview' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'preview' }, (a) => ({
            loader: 'jsx',
            resolveDir: process.cwd(),
            contents: a.path.includes('vector-icons')
              ? 'import React from "react";import {Text} from "react-native";export const Feather=()=> <Text style={{color:"white"}}>◇</Text>;export const Ionicons=Feather;'
              : a.path.includes('safe-area')
                ? 'export const useSafeAreaInsets=()=>({top:0,bottom:20,left:0,right:0});'
                : a.path.includes('auth-context')
                  ? 'export const useAuth=()=>({user:{id:"test"}});'
                  : a.path.endsWith('/auth')
                    ? 'export const authenticatedFetch=(...args)=>fetch(...args);'
                    : a.path.includes('large-device-storage')
                      ? 'export const largeDeviceStorage={get:async k=>localStorage.getItem(k),set:async(k,v)=>localStorage.setItem(k,v)};'
                      : a.path.includes('file-system')
                        ? 'export const cacheDirectory="/tmp/";export const EncodingType={Base64:"base64"};export const writeAsStringAsync=async()=>{};'
                        : 'export const isAvailableAsync=async()=>true;export const shareAsync=async()=>{};',
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  });
  js = result.outputFiles![0]!.text;
});
test('native slip opens above navigation and saves to existing account workflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let saved: any[] = [];
  await page.route('**/api/user/saved-content', async (r) => {
    if (r.request().method() === 'POST') {
      saved.push(r.request().postDataJSON());
      await r.fulfill({ json: { ok: true } });
    } else await r.fulfill({ json: { items: saved } });
  });
  await page.route('https://native.test/**', (r) =>
    r.request().url().includes('/api/')
      ? r.fallback()
      : r.fulfill({
          contentType: 'text/html',
          body:
            '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>' +
            js +
            '</script>',
        }),
  );
  await page.goto('https://native.test');
  await page.getByRole('button', { name: 'Open Lab Score Guide', exact: true }).click();
  await expect(page.getByText('95–99 · EXCEPTIONAL', { exact: true })).toBeVisible();
  await expect(page.getByText('0–49 · POOR', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Lab Score Guide', exact: true }).click();

  await page.getByRole('button', { name: 'Add first' }).click();
  const bar = page.getByRole('button', { name: 'Expand My Parlay (1)' });
  const rect = await bar.boundingBox();
  const nav = await page.getByTestId('bottom-nav').boundingBox();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(nav!.y);
  await bar.click();
  await expect(page.getByText('KC vs BUF')).toBeVisible();
  await expect(page.getByText('-200 · Lab Score 84').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actions & details' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Actions & details' }).click();
  await page.getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(page.getByText('Saved to your account and My Parlays.')).toBeVisible();
  await page.getByRole('tab', { name: 'Saved', exact: true }).click();
  await expect(page.getByText('1 Leg Parlay · -200')).toBeVisible();
  await page.getByRole('tab', { name: 'Parlay', exact: true }).click();
  await page.screenshot({ path: '/tmp/parlay-slip-native.png' });
  await page.getByRole('button', { name: 'Remove Player One' }).click();
  await expect(page.getByText('Build Your Parlay')).toBeVisible();
  await page.getByRole('button', { name: 'Close parlay', exact: true }).click();
  await page.getByRole('button', { name: 'Add long parlay', exact: true }).click();
  await page.getByRole('button', { name: 'Expand My Parlay (16)' }).click();
  await expect(page.getByRole('button', { name: 'SAVE', exact: true })).toBeInViewport();
});

for (const team of ['KC', 'SEA'])
  test(`native FanDuel ${team} transfer uses shared state and preserves the slip`, async ({
    page,
  }) => {
    let starts = 0;
    let mode = 'pending';
    await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { books: ['fanduel'] } });
      const body = r.request().postDataJSON();
      if (body.action === 'preview')
        return r.fulfill({
          json: {
            proposals:
              body.ids.length === 1 ? [fixtureProposal(body.ids, 'fanduel', false, true)] : [],
          },
        });
      if (body.action === 'start') {
        starts++;
        expect(Object.keys(body).sort()).toEqual(['action', 'approved', 'sportsbook', 'token']);
      }
      return r.fulfill({
        json: {
          id: 'native-job',
          status: mode === 'complete' && body.action === 'start' ? 'pending' : mode,
          url: 'https://gambly.com/deeplink/deeplink-cache-nativefixture?utm_campaign=downanddistance',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      });
    });
    await page.route('https://native.test/**', (r) =>
      r.request().url().includes('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body:
              '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>' +
              js +
              '</script>',
          }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('https://native.test?team=' + team);
    await page.getByRole('button', { name: 'Add first', exact: true }).click();
    await page.getByRole('button', { name: 'Expand My Parlay (1)' }).click();
    await expect(page.getByLabel(/FanDuel · Estimated odds/)).toBeVisible();
    expect(starts).toBe(0);
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await expect(page.getByRole('button', { name: 'Recheck Stored Availability' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true }),
    ).toBeEnabled();
    expect(starts).toBe(0);
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await expect(
      page.getByRole('button', { name: 'Select FanDuel region', exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() => {
      (window as any).__openedLinks = [];
      window.open = ((url: string) => {
        (window as any).__openedLinks.push(url);
        return null;
      }) as typeof window.open;
    });
    await page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true }).click();
    await expect(page.getByText('Preparing Your FanDuel Slip...')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__openedLinks)).toEqual([]);
    await page.getByRole('button', { name: 'Cancel wait', exact: true }).click();
    mode = 'complete';
    await page.getByRole('button', { name: 'Open in FanDuel ↗', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open in FanDuel ↗' })).toBeVisible();
    expect(starts).toBe(2);
    await expect(page.getByText('Your FanDuel Slip Is Ready.')).toBeVisible();
    // The click while pending opens the validated result without a second click.
    expect(await page.evaluate(() => (window as any).__openedLinks)).toEqual([
      'https://gambly.com/deeplink/deeplink-cache-nativefixture?utm_campaign=downanddistance',
    ]);
    await page.getByRole('button', { name: 'Actions & details' }).click();
    await expect(
      page.getByText(
        'Selections may be added to your existing sportsbook bet slip. Review all legs and final odds before continuing.',
      ),
    ).toBeVisible();
    await page.screenshot({ path: `/tmp/fanduel-native-${team}.png` });
    await page.getByRole('button', { name: 'Remove Player One' }).click();
    await expect(page.getByRole('link', { name: 'Open in FanDuel ↗' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close parlay', exact: true }).click();
    await page.getByRole('button', { name: 'Add long parlay', exact: true }).click();
    await page.getByRole('button', { name: 'Expand My Parlay (16)' }).click();
    await expect(page.getByRole('button', { name: 'Open in FanDuel ↗' })).toHaveCount(0);
    await expect(page.getByText(/Stored odds do not support a complete slip/)).toBeVisible();
    expect(starts).toBe(2);
    expect(await page.evaluate(() => (window as any).__openedLinks)).toEqual([
      'https://gambly.com/deeplink/deeplink-cache-nativefixture?utm_campaign=downanddistance',
    ]);
  });
for (const team of ['KC', 'SEA'])
  test(`native ${team} sportsbook substitution requires approval and preserves original`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open;
    });
    const submissions: any[] = [];
    await page.route('**/api/parlay-lab/sportsbook-transfer', async (r) => {
      if (r.request().method() === 'GET')
        return r.fulfill({ json: { books: ['betmgm', 'caesars', 'draftkings', 'fanduel'] } });
      const b = r.request().postDataJSON();
      if (b.action === 'preview')
        return r.fulfill({
          json: {
            proposals: [
              fixtureProposal(b.ids, 'betmgm', false, true),
              fixtureProposal(b.ids, 'caesars', true, true),
              fixtureProposal(b.ids, 'draftkings', false, true),
              fixtureProposal(b.ids, 'fanduel', true, true),
            ],
          },
        });
      submissions.push(b);
      return r.fulfill({
        json: {
          id: 'native-job',
          status: 'complete',
          url: `https://gambly.com/deeplink/deeplink-cache-${b.sportsbook}?utm_campaign=downanddistance`,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      });
    });
    await page.route('https://native.test/**', (r) =>
      r.request().url().includes('/api/')
        ? r.fallback()
        : r.fulfill({
            contentType: 'text/html',
            body:
              '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>' +
              js +
              '</script>',
          }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('https://native.test?team=' + team);
    await page.getByRole('button', { name: 'Add first', exact: true }).click();
    await page.getByRole('button', { name: 'Expand My Parlay (1)' }).click();
    const dk = page.getByRole('button', { name: 'Open in DraftKings ↗' }),
      fd = page.getByRole('button', { name: 'Open in FanDuel ↗' });
    await expect(dk).toBeVisible();
    await expect(fd).toBeVisible();
    expect((await dk.boundingBox())!.y).toBeLessThan((await fd.boundingBox())!.y);
    await fd.click();
    await expect(page.getByText('FanDuel Line Adjustment')).toBeVisible();
    expect(submissions).toHaveLength(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(submissions).toHaveLength(0);
    await fd.click();
    await expect(page.getByText(/Proposed:.*3.5/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue with Adjustment' }).click();
    await expect(page.getByText('Your FanDuel Slip Is Ready.')).toBeVisible();
    expect(submissions[0].approved).toBe(true);
    await expect(page.getByText('RECEPTIONS — OVER 4.5', { exact: true }).first()).toBeVisible();
    await dk.click();
    await expect(page.getByText('Your DraftKings Slip Is Ready.')).toBeVisible();
    expect(submissions[1].approved).toBe(false);
    expect(page.context().pages()).toHaveLength(1);
    await page.getByRole('button', { name: 'Open in BetMGM ↗' }).click();
    await expect(page.getByText('Your BetMGM Slip Is Ready.')).toBeVisible();
    expect(submissions[2].sportsbook).toBe('betmgm');
    await page.getByRole('button', { name: 'Open in Caesars ↗' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(submissions).toHaveLength(3);
    await page.getByRole('button', { name: 'Open in Caesars ↗' }).click();
    await page.getByRole('button', { name: 'Continue with Adjustment' }).click();
    await expect(page.getByText('Your Caesars Slip Is Ready.')).toBeVisible();
    expect(submissions[3].sportsbook).toBe('caesars');
    expect(submissions[3].approved).toBe(true);
    await page.screenshot({ path: `/tmp/multibook-native-${team}.png` });
  });
