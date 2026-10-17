import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/lab-score-details.tsx'],
    bundle: true,
    write: false,
    outfile: 'score.js',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
    plugins: [
      {
        name: 'font',
        setup(b) {
          b.onResolve({ filter: /^next\/font\/google$/ }, () => ({
            path: 'font',
            namespace: 'mock',
          }));
          b.onLoad({ filter: /font/, namespace: 'mock' }, () => ({
            contents: 'export const Barlow_Condensed=()=>({variable:"barlow-font"});',
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
});
for (const team of ['KC', 'SEA'])
  for (const width of [320, 768, 1440]) {
    test(`${team} score details and modal at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 950 });
      await page.route('https://score-preview.test/**', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
        }),
      );
      await page.goto(`https://score-preview.test/?team=${team}`);
      await page.addStyleTag({
        content: `*{box-sizing:border-box}body{margin:0;background:#00141e;color:#f4f8fc;font-family:Arial}${css}`,
      });
      await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}};' + js });
      await expect(page.getByText('Role change detected', { exact: true })).toBeVisible();
      await expect(page.getByText(/Shadow model awaiting/)).toHaveCount(0);
      await expect(
        page.getByText('There is not enough current information to estimate confidence.').first(),
      ).toBeVisible();
      await page.getByRole('button', { name: /Lab Score.*projection details/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('The pick', { exact: true })).toBeVisible();
      await expect(dialog.getByText('History', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Projection Edge · 25%', { exact: true })).toBeVisible();
      await expect(dialog.getByText(/Estimated hit probability:/)).toBeVisible();
      await expect(dialog.getByText('Expected work', { exact: true })).toBeVisible();
      await expect(dialog.getByText(/Shadow model|Evidence and confidence limits/)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `/tmp/lab-score-${team}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Close explanation' }).click();
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
