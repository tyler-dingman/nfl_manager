import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/article-hero.tsx'],
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
  const font = readFileSync('apps/mobile/assets/fonts/BarlowCondensed-ExtraBold.ttf').toString(
    'base64',
  );
  css += `@font-face{font-family:BarlowCondensed;src:url(data:font/ttf;base64,${font})}.beat-font{--font-beat-barlow:BarlowCondensed}`;
});
for (const team of ['KC', 'SEA'])
  for (const width of [320, 390, 768, 1440]) {
    test(`${team} compact article variants at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 960 });
      await page.route('https://static.www.nfl.com/**', (r) => r.abort());
      await page.route('https://article-preview.test/**', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
        }),
      );
      await page.goto(`https://article-preview.test/?team=${team}`);
      await page.addStyleTag({
        content: `*{box-sizing:border-box}body{margin:0;font-family:Arial} ${css}`,
      });
      await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}};' + js });
      await expect(page.locator('[data-article-hero]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const measurements = await page.locator('[data-article-hero]').evaluateAll((heroes) =>
        heroes.map((hero) => {
          const rect = hero.getBoundingClientRect();
          const heading = hero.querySelector('h1')!;
          const texts = [heading, ...hero.querySelectorAll('p,time')];
          return {
            id: hero.getAttribute('data-story-id'),
            height: rect.height,
            gap: hero.nextElementSibling!.getBoundingClientRect().top - rect.bottom,
            overflow: texts.some((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.left < rect.left ||
                r.right > rect.right + 1 ||
                r.bottom > rect.bottom + 1 ||
                el.scrollWidth > el.clientWidth + 1
              );
            }),
            clamp: getComputedStyle(heading).webkitLineClamp,
          };
        }),
      );
      for (const m of measurements) {
        expect(m.overflow, m.id!).toBe(false);
        expect(m.gap).toBe(0);
        expect(m.clamp).toBe('none');
        expect(m.height, m.id!).toBeLessThanOrEqual(width >= 1024 ? 270 : width >= 768 ? 340 : 410);
      }
      const regular = measurements.filter((m) => !m.id!.startsWith('long-'));
      expect(
        Math.max(...regular.map((m) => m.height)) - Math.min(...regular.map((m) => m.height)),
        JSON.stringify(regular),
      ).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      expect(errors).toEqual([]);
      if (width === 1440 || width === 390)
        await page
          .locator('[data-story-id="player"]')
          .locator('..')
          .screenshot({ path: `/tmp/article-hero-${team}-${width}.png` });
    });
  }
