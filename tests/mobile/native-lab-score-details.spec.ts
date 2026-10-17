import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/native-lab-score-details.jsx'],
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
          b.onResolve({ filter: /^@expo\/vector-icons$/ }, () => ({
            path: 'icons',
            namespace: 'preview',
          }));
          b.onLoad({ filter: /icons/, namespace: 'preview' }, () => ({
            contents:
              'import React from "react";import {Text} from "react-native";export const Feather=()=> <Text style={{color:"white"}}>◇</Text>;',
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
test('native score adapter wraps and clears bottom navigation in browser preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0;background:#00141e}</style><div id="root"></div><div style="position:fixed;bottom:0;height:80px;background:#102532;width:100%;color:white">Bottom navigation clearance preview</div>',
  );
  await page.addScriptTag({ content: js });
  await expect(page.getByText(/ROLE CHANGE DETECTED/)).toBeVisible();
  await expect(page.getByText('Projection Edge · 25%', { exact: true }).first()).toBeVisible();
  await page.getByTestId('content-end').scrollIntoViewIfNeeded();
  const end = await page.getByTestId('content-end').boundingBox();
  expect(end!.y + end!.height).toBeLessThanOrEqual(764);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/native-lab-score-preview.png' });
});
