import { test, expect } from '@playwright/test';

const ensureNoOverflow = async (page: any) => {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
  expect(hasOverflow).toBeFalsy();
};

test('contract offer modal is scrollable on mobile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Philadelphia Eagles/i }).click();
  await expect(page).toHaveURL(/\/experience/);
  await page.getByRole('button', { name: /Free Agency/i }).click();
  await page.getByRole('button', { name: /Continue/i }).click();

  await expect(page).toHaveURL(/\/free-agents/);

  const offerButton = page.getByRole('button', { name: /^Offer$/ }).first();
  await offerButton.click();

  const modal = page.locator('[role="dialog"], .max-h\\[90dvh\\]');
  await expect(modal.first()).toBeVisible();

  await ensureNoOverflow(page);
});
