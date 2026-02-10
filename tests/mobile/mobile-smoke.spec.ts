import { test, expect } from '@playwright/test';

const assertNoHorizontalOverflow = async (page: any) => {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
  expect(hasOverflow).toBeFalsy();
};

test('team select loads on mobile without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Choose a Team/i })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('experience screen loads after selecting a team', async ({ page }) => {
  await page.goto('/');
  const teamButton = page.getByRole('button', { name: /Philadelphia Eagles/i });
  await teamButton.click();
  await expect(page).toHaveURL(/\/experience/);
  await expect(page.getByRole('heading', { name: /Choose your experience/i })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
