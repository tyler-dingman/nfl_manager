import { test, expect } from '@playwright/test';

test('draft board loads on mobile without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Philadelphia Eagles/i }).click();
  await expect(page).toHaveURL(/\/experience/);
  await page.getByRole('button', { name: /Draft/i }).click();
  await page.getByRole('button', { name: /Continue/i }).click();

  await expect(page).toHaveURL(/\/draft\/room/);

  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
  expect(hasOverflow).toBeFalsy();
});
