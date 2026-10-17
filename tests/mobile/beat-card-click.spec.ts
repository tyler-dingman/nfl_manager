import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/beat-card-click.tsx'],
    bundle: true,
    write: false,
    outfile: 'hero.js',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'next-preview',
        setup(b) {
          b.onResolve({ filter: /next\/font\/google/ }, () => ({
            path: 'font',
            namespace: 'preview',
          }));
          b.onLoad({ filter: /font/, namespace: 'preview' }, () => ({
            contents: 'export const Barlow_Condensed=()=>({variable:"beat-font"});',
          }));
          b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'preview' }));
          b.onLoad({ filter: /image/, namespace: 'preview' }, () => ({
            contents:
              'import React from "react";export default function Image({fill,unoptimized,...props}){return <img {...props} style={fill?{width:"100%",height:"100%",objectFit:"contain"}:undefined}/>}',
            loader: 'jsx',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
  css += (
    await postcss([
      tailwindcss({
        content: [
          'src/components/crew/share-to-crew-button.tsx',
          'src/components/ui/football-icons.tsx',
        ],
      }),
    ]).process('@tailwind base;@tailwind utilities;', { from: undefined })
  ).css;
});
for (const team of ['KC', 'SEA'])
  for (const width of [390, 1440]) {
    test(`${team} whole Beat card and independent controls at ${width}px`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.route('https://beat-preview.test/**', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
        }),
      );
      await page.route('**/api/crew/share', (r) => r.fulfill({ json: { recipients: [] } }));
      await context.route('https://source-preview.test/**', (r) =>
        r.fulfill({ body: 'Original reporting' }),
      );
      const mount = async () => {
        await page.goto(`https://beat-preview.test/?team=${team}`);
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}};' + js });
        await expect(page.locator('[data-beat-card]')).toBeVisible();
      };
      await mount();
      const card = page.locator('[data-beat-card]');
      // Exercise real link navigation from artwork, body padding, and footer padding.
      for (const area of ['artwork', 'body', 'footer']) {
        const point = await card.evaluate((el, area) => {
          const r = (
            area === 'artwork'
              ? el.querySelector('[data-beat-family]')!
              : area === 'footer'
                ? el.querySelector('footer')!
                : el.children[1]
          ).getBoundingClientRect();
          return area === 'artwork'
            ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
            : { x: area === 'footer' ? r.right - 4 : r.left + 2, y: r.top + 4 };
        }, area);
        await page.mouse.click(point.x, point.y);
        await expect(page).toHaveURL(/\/content\/click-story$/);
        await mount();
      }
      const storyLink = page.getByRole('link', { name: /^Open story:/ });
      await storyLink.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/content\/click-story$/);
      await mount();
      await page.getByRole('button', { name: /^Save / }).click();
      await expect(page.getByRole('button', { name: /^Remove / })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByLabel('View 1 source', { exact: true }).click();
      await expect(page.locator('details')).toHaveAttribute('open', '');
      const popupPromise = context.waitForEvent('page');
      await page.getByRole('link', { name: 'Original reporting' }).click();
      const popup = await popupPromise;
      await popup.waitForURL('https://source-preview.test/story');
      await popup.close();
      await page.getByRole('button', { name: 'Share with the Crew' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.locator('body').getAttribute('data-opened')).toBeNull();
      await expect(page).toHaveURL(new RegExp(`\\?team=${team}$`));
      await page.getByRole('link', { name: 'DISCUSS' }).click();
      await expect(page).toHaveURL(new RegExp(`/huddle\\?team=${team}&discussion=click-story$`));
    });
  }
