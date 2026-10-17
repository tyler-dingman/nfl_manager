import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/native-grouped-props.jsx'],
    bundle: true,
    write: false,
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
      'react-native-safe-area-context': path.resolve(
        'apps/mobile/node_modules/react-native-safe-area-context',
      ),
      'react-native-svg': path.resolve(
        'apps/mobile/node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js',
      ),
      'react-native': path.resolve('apps/mobile/node_modules/react-native-web'),
      react: path.resolve('apps/mobile/node_modules/react'),
      'react-dom': path.resolve('apps/mobile/node_modules/react-dom'),
    },
    plugins: [
      {
        name: 'icons',
        setup(b) {
          b.onResolve({ filter: /^expo-router$/ }, () => ({
            path: 'router',
            namespace: 'preview',
          }));
          b.onLoad({ filter: /^router$/, namespace: 'preview' }, () => ({
            contents: `import {useSyncExternalStore} from 'react';
              const subscribe=(cb)=>{window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb)};
              export const useLocalSearchParams=()=>Object.fromEntries(new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search)));
              export const router={setParams(values){const url=new URL(location.href);Object.entries(values).forEach(([k,v])=>v===undefined?url.searchParams.delete(k):url.searchParams.set(k,v));history.replaceState(null,'',url);dispatchEvent(new PopStateEvent('popstate'));}};`,
            loader: 'js',
            resolveDir: process.cwd(),
          }));
          b.onResolve({ filter: /^expo-secure-store$/ }, () => ({
            path: 'secure',
            namespace: 'preview',
          }));
          b.onLoad({ filter: /secure/, namespace: 'preview' }, () => ({
            contents:
              'export const deleteItemAsync=async()=>{};export const getItemAsync=async()=>null;export const setItemAsync=async()=>{};',
            loader: 'js',
          }));
          b.onResolve({ filter: /^@expo\/vector-icons$/ }, () => ({
            path: 'icons',
            namespace: 'preview',
          }));
          b.onLoad({ filter: /icons/, namespace: 'preview' }, () => ({
            contents:
              'import React from "react";import {Text} from "react-native";export const Feather=()=> <Text style={{color:"white"}}>ⓘ</Text>;export const Ionicons=()=> <Text style={{color:"white"}}>◇</Text>;',
            loader: 'jsx',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  });
  js = result.outputFiles![0]!.text;
});

test('native grouped selections, per-line eligibility and selection persistence in browser preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://native.test/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body:
        '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0;background:#00141e}</style><div id="root"></div><script>' +
        js +
        '</script>',
    }),
  );
  await page.goto('https://native.test');
  await expect(page.getByRole('button', { name: 'Back to all prop categories' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Receiving', exact: true }).click();
  await expect(page).toHaveURL(/category=receiving/);
  await expect(page.getByRole('button', { name: 'All Receiving', exact: true })).toHaveCSS(
    'background-color',
    'rgb(255, 18, 62)',
  );
  await page.getByRole('button', { name: 'Receptions', exact: true }).click();
  await expect(page).toHaveURL(/market=receptions/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Receptions', exact: true })).toHaveCSS(
    'background-color',
    'rgb(255, 18, 62)',
  );
  await page
    .getByRole('button', { name: 'Expand Player One Receptions lines', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Add Player One Receptions O 1.5 at DraftKings to parlay',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Add Player One Receptions O 2.5 at DraftKings to parlay',
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => (window as any).__added.id)).toBe('alt');
  await page.getByRole('button', { name: 'Open Trending Props', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Add Player One Receptions O 1.5 at DraftKings to parlay',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByText('My Parlay: alt', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Add Player One Receptions O 2.5 at DraftKings to parlay',
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Open Lab Score Guide', exact: true }).first().click();
  await expect(page.getByText('95–99 · EXCEPTIONAL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Lab Score Guide', exact: true }).click();
  await expect(page.getByText('95–99 · EXCEPTIONAL', { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Back to all prop categories' }).click();
  await expect(page.getByRole('button', { name: 'Receiving', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('category')).toBe(false);
  expect(new URL(page.url()).searchParams.has('market')).toBe(false);
  await expect(page.getByText('My Parlay: alt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Receiving', exact: true }).click();
  await page.screenshot({ path: '/tmp/native-grouped-props.png', fullPage: true });
});
