import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
test('account fits mobile, persists switches, edits profile and confirms deletion', async ({
  page,
}) => {
  const result = await build({
    entryPoints: ['tests/mobile/fixtures/account.tsx'],
    bundle: true,
    write: false,
    outfile: 'account.js',
    external: ['/assets/*'],
    loader: { '.css': 'local-css' },
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
    alias: { 'next/navigation': path.resolve('tests/mobile/fixtures/account-navigation.ts') },
  });
  const css = result.outputFiles!.find((f) => f.path.endsWith('.css'))!.text,
    script = result.outputFiles!.find((f) => f.path.endsWith('.js'))!.text;
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}button{background:none;cursor:pointer}a{color:inherit;text-decoration:none}${css}</style><div id="root"></div>`,
  );
  await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"development"}}' });
  await page.addScriptTag({ content: script });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.getByRole('heading', { name: 'Tyler Football Fan' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 960 });
  await page.getByRole('switch', { name: 'Email Notifications', exact: true }).uncheck();
  expect(await page.evaluate(() => document.body.dataset.mutation)).toBe('{"emailEnabled":false}');
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Updated Fan');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeDisabled();
  const previous = await page.evaluate(() => document.body.dataset.mutation);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();
  expect(await page.evaluate(() => document.body.dataset.mutation)).toBe(previous);
  await page.screenshot({ path: '/tmp/account-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/tmp/account-desktop.png', fullPage: true });
});
