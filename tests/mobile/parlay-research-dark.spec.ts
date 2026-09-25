import { test, expect } from '@playwright/test';
test('live player research stays dark across all tabs', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1536, height: 1100 });
  await page.goto('/parlay-lab/trends?team=KC');
  await page.locator('.lab-spotlight-prop').first().click({ timeout: 45000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Last 10 Games', { exact: true })).toBeVisible({ timeout: 45000 });
  for (const tab of ['Overview', 'Game Log', 'Matchup', 'Splits', 'Line Ladder']) {
    await dialog.getByRole('tab', { name: tab, exact: true }).click();
    await expect(dialog.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    if (['Game Log', 'Matchup', 'Line Ladder'].includes(tab)) {
      await dialog.locator('canvas').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(450); // Let the existing chart transition finish for the visual audit.
    }
    await page.screenshot({ path: `artifacts/research-dark-${tab.replaceAll(' ', '-')}.png` });
    const light = await dialog.evaluate((root) =>
      [root, ...root.querySelectorAll('*')]
        .filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width < 35 || rect.height < 20 || style.visibility === 'hidden') return false;
          const color = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
          return (
            color &&
            color.length >= 3 &&
            (color[3] ?? 1) > 0.8 &&
            color.slice(0, 3).every((c) => c > 180)
          );
        })
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          color: getComputedStyle(el).backgroundColor,
        })),
    );
    expect(light).toEqual([]);
  }
  await dialog.getByRole('tab', { name: 'Overview', exact: true }).click();
  const add = dialog.getByRole('button', { name: /Add.*Parlay/i }).first();
  await add.click();
  await expect(dialog.getByRole('button', { name: /Added/i }).first()).toBeVisible();
});
