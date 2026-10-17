import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/native-play-navigation.jsx'],
    bundle: true,
    write: false,
    jsx: 'automatic',
    loader: { '.svg': 'dataurl' },
    alias: {
      'react-native': path.resolve('apps/mobile/node_modules/react-native-web'),
      react: path.resolve('apps/mobile/node_modules/react'),
      'react-dom': path.resolve('apps/mobile/node_modules/react-dom'),
    },
    plugins: [
      {
        name: 'native-preview',
        setup(b) {
          const stubs: Record<string, string> = {
            'expo-router': 'export const usePathname=()=>window.__path;',
            'expo-image': 'export const Image=()=>null;',
            '@expo/vector-icons': 'export const Ionicons=()=>null;',
            '../lib/auth-context': 'export const useAuth=()=>({user:null,logout:async()=>{}});',
            '../lib/team-branding':
              'export const useTeamBranding=()=>({teamId:window.__team,theme:{secondary:window.__team==="SEA"?"#69be28":"#ffbe00"}});',
          };
          b.onResolve({ filter: /.*/ }, (a) =>
            a.path in stubs ? { path: a.path, namespace: 'preview' } : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: 'preview' }, (a) => ({
            contents: stubs[a.path],
            loader: 'js',
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  });
  js = result.outputFiles![0].text;
});
for (const team of ['KC', 'SEA'])
  test(`native ${team} Play expansion and existing Trivia route`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}</style><div id="root"></div>',
    );
    await page.addScriptTag({
      content: `window.__team=${JSON.stringify(team)};window.__path='/';` + js,
    });
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(page.getByRole('link', { name: 'Trivia', exact: true })).toHaveCount(0);
    await play.click();
    await expect(page.getByRole('link', { name: 'Trivia', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Trivia', exact: true }).click();
    expect(await page.evaluate(() => (window as any).__destination)).toBe('/trivia');
    await page.screenshot({ path: `/tmp/native-play-${team}.png` });
    await play.click();
    await expect(page.getByRole('link', { name: 'Trivia', exact: true })).toHaveCount(0);
  });
