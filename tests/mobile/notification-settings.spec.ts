import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
test('notification preferences fit mobile and save only confirmed changes', async ({ page }) => {
  const bundle = await build({
    entryPoints: ['tests/mobile/fixtures/notification-settings.tsx'],
    bundle: true,
    write: false,
    outfile: 'notifications.js',
    external: ['/assets/*'],
    loader: { '.css': 'local-css' },
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
    alias: { 'next/navigation': path.resolve('tests/mobile/fixtures/account-navigation.ts') },
  });
  const utilities = (
    await postcss([
      tailwindcss({
        content: ['src/components/notifications/*.tsx', 'src/components/three-and-out/*.tsx'],
      }),
    ]).process('@tailwind base; @tailwind utilities;', { from: undefined })
  ).css;
  const css = bundle.outputFiles!.find((f) => f.path.endsWith('.css'))!.text;
  const js = bundle.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  await page.setContent(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}button{background:none;cursor:pointer;border:0}button:focus-visible{outline:2px solid blue}${utilities}${css}</style><div id="root"></div>`,
  );
  await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}}' });
  await page.addScriptTag({ content: js });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.getByRole('heading', { name: 'Stay in the know' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const toggle = page.getByRole('switch', { name: 'Team News & Updates' });
  await expect(toggle).toBeChecked(); // scoped preferences must not override the global setting
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(document.body.dataset.mutation!))).toEqual({
    category: 'BREAKING_NEWS',
    channel: 'IN_APP',
    enabled: false,
  });
  await page.evaluate(() => {
    document.body.dataset.fail = 'true';
  });
  await toggle.click();
  await expect(page.getByText('Some changes could not be saved. Please try again.')).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await page.evaluate(() => {
    document.body.dataset.fail = 'false';
  });
  await page.getByRole('button', { name: 'Turn All On' }).click();
  await expect(toggle).toBeChecked();
  await page.getByRole('button', { name: 'SMS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SMS', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => JSON.parse(document.body.dataset.mutation!))).toMatchObject({
    email: true,
    sms: true,
    push: false,
    enabled: true,
  });
  await page.getByRole('button', { name: 'Evening 6:00 PM' }).click();
  await expect(page.getByRole('button', { name: 'Evening 6:00 PM' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => JSON.parse(document.body.dataset.mutation!))).toMatchObject({
    deliveryTime: '18:00',
    email: true,
    sms: true,
  });
  await page.getByRole('button', { name: 'Custom Choose a time' }).click();
  await page.getByLabel('Delivery time', { exact: true }).fill('08:30');
  await expect(page.getByLabel('Delivery time', { exact: true })).toHaveValue('08:30');
  expect(await page.evaluate(() => JSON.parse(document.body.dataset.mutation!))).toMatchObject({
    deliveryTime: '08:30',
  });
  await page.setViewportSize({ width: 390, height: 960 });
  await page.screenshot({ path: '/tmp/notifications-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: '/tmp/notifications-desktop.png', fullPage: true });
});
