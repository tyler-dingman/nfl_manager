import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let script = '',
  css = '';
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/player-cards.tsx'],
    bundle: true,
    write: false,
    outfile: 'player-cards.js',
    loader: { '.css': 'local-css' },
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
});
test('player cards share state/actions, respect disabled actions, and replace wide tables only on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}.legacy-table{min-width:900px}button{background:none;border:0;font:inherit}${css}</style><div id="root"></div>`,
  );
  await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}}' });
  await page.addScriptTag({ content: script });
  for (const width of [320, 390, 767]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('article:visible')).toHaveCount(2);
    await expect(page.locator('table')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await page.getByRole('button', { name: 'Actions for Chris Jones' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Trade player' }),
  ).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'View player' }).click();
  await expect(page.getByRole('status')).toHaveText('Chris Jones');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Position', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'QB', exact: true }).click();
  await expect(page.locator('article:visible')).toHaveCount(1);
  await expect(page.locator('article:visible')).toContainText('Patrick Mahomes');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('table')).toBeVisible();
  await expect(page.locator('article:visible')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
