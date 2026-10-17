import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/play-navigation.tsx'],
    bundle: true,
    write: false,
    outfile: 'nav.js',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'next-preview',
        setup(b) {
          b.onResolve({ filter: /^next\/(link|navigation)$/ }, (a) => ({
            path: a.path,
            namespace: 'preview',
          }));
          b.onLoad({ filter: /.*/, namespace: 'preview' }, (a) => ({
            loader: 'jsx',
            resolveDir: process.cwd(),
            contents: a.path.endsWith('navigation')
              ? 'export const usePathname=()=>location.pathname;export const useRouter=()=>({push(){},refresh(){}});'
              : 'import React from "react";export default function Link(props){return <a {...props}/>;}',
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  const utilities = await postcss([
    tailwind({
      content: ['src/components/primary-navigation.tsx', 'src/components/mobile-site-menu.tsx'],
      corePlugins: { preflight: true },
    }),
  ]).process('@tailwind base;@tailwind utilities;', { from: undefined });
  css = utilities.css + result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: any, width: number, team: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('https://navigation.test/**', (r: any) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    }),
  );
  await page.route('**/api/auth/me', (r: any) => r.fulfill({ json: { user: null } }));
  await page.goto(`https://navigation.test/trivia/join/example?team=${team}`);
  await page.addStyleTag({ content: css + 'body{background:#081824;color:white;padding:20px}' });
  await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}};' + js });
}
for (const team of ['KC', 'SEA']) {
  test(`${team} Play desktop keyboard, hover and active route`, async ({ page }) => {
    await mount(page, 1280, team);
    const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
    const play = nav.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Trivia', exact: true })).toHaveCount(0);
    await play.hover();
    await expect(play).toHaveAttribute('aria-expanded', 'true');
    const trivia = nav.getByRole('link', { name: 'Trivia', exact: true });
    await expect(trivia).toHaveAttribute('href', `/trivia?team=${team}`);
    await page.getByRole('button', { name: 'Outside' }).hover();
    await expect(play).toHaveAttribute('aria-expanded', 'false');
    await play.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trivia).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(play).toBeFocused();
    await expect(play).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowDown');
    await expect(trivia).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(play).toHaveAttribute('aria-expanded', 'false');
    await play.click();
    await expect(trivia).toBeVisible();
    await page.screenshot({ path: `/tmp/play-nav-${team}-desktop.png` });
    await trivia.click();
    await expect(page).toHaveURL(`https://navigation.test/trivia?team=${team}`);
  });
  test(`${team} mobile drawer expands Play and preserves escape behavior`, async ({ page }) => {
    await mount(page, 390, team);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Site menu' }),
      play = dialog.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toHaveAttribute('aria-current', 'page');
    await expect(dialog.getByRole('link', { name: 'Trivia', exact: true })).toHaveCount(0);
    await play.click();
    const trivia = dialog.getByRole('link', { name: 'Trivia', exact: true });
    await expect(trivia).toHaveAttribute('href', `/trivia?team=${team}`);
    await trivia.focus();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(play).toHaveAttribute('aria-expanded', 'false');
    await play.click();
    await expect(trivia).toBeVisible();
    await page.screenshot({ path: `/tmp/play-nav-${team}-mobile.png` });
    await trivia.click();
    await expect(page).toHaveURL(`https://navigation.test/trivia?team=${team}`);
  });
}
