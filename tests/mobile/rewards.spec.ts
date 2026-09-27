import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
test('rewards fit mobile and desktop while preserving tiers and claim actions', async ({
  page,
}) => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/rewards.tsx'],
    bundle: true,
    external: ['/assets/*'],
    write: false,
    outfile: 'rewards.js',
    loader: { '.css': 'local-css' },
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
  });
  const css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
  const script = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.setContent(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#f5f7f9}button{border:0;background:none;cursor:pointer}a{color:inherit;text-decoration:none}${css}</style><div id="root"></div>`,
    );
    await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}}' });
    await page.addScriptTag({ content: script });
    await expect(page.getByRole('heading', { name: 'Your Progress' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('[aria-current="step"]')).toContainText('Starter');
    await page.getByRole('button', { name: 'Generate code' }).first().click();
    expect(await page.evaluate(() => document.body.dataset.claim)).toBe('yards-50');
    await page.getByRole('button', { name: 'View All Rewards' }).click();
    await expect(page.getByRole('heading', { name: '40% off one merch order' })).toBeVisible();
    if (width === 1440) {
      const title = await page.locator('h1').boundingBox();
      const progress = await page.getByRole('heading', { name: 'Your Progress' }).boundingBox();
      expect(progress!.x).toBeGreaterThan(title!.x + 200);
    }
    if (width === 390) await page.screenshot({ path: '/tmp/rewards-mobile.png', fullPage: true });
    if (width === 1440) await page.screenshot({ path: '/tmp/rewards-desktop.png', fullPage: true });
  }
});
