import { test, expect } from '@playwright/test';

for (const path of ['/parlay-lab', '/watch', '/trivia']) {
  test(`header search stays on ${path}`, async ({ page }) => {
    await page.goto(path);
    const initialUrl = page.url();
    const trigger = page.getByRole('button', { name: 'Search', exact: true }).first();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Search Down & Distance' });
    await expect(dialog).toBeVisible();
    expect(page.url()).toBe(initialUrl);
    await expect(dialog.getByRole('searchbox').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(page.url()).toBe(initialUrl);
  });
}
