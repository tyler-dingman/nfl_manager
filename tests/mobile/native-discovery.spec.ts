import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/native-discovery.jsx'],
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
              'import React from "react";import {Text} from "react-native";export const Ionicons=()=> <Text style={{color:"white"}}>◇</Text>;',
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
test('native discovery controls persist and remain independent in browser preview', async ({
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
  await page.getByRole('checkbox', { name: 'Alt Lines', exact: true }).click();
  await page.getByRole('button', { name: 'Max Odds: -1000', exact: true }).click();
  await page.getByRole('button', { name: '-400', exact: true }).click();
  await page.getByRole('checkbox', { name: 'My Team Only', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Alt Lines', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Open Home', exact: true }).click();
  await expect(page.getByText('Mode: Alternate / -400')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Mode: Alternate / -400')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Alt Lines', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Max Odds: -400', exact: true })).toHaveCount(0);
  await expect(page.getByText('Mode: Standard / -400')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/native-alt-discovery.png' });
});
