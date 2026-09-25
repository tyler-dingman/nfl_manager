import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`Beat pagination retains the requested page while loading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/content/huddle?*', async (route) => {
      const query = new URL(route.request().url()).searchParams;
      const current = Math.min(3, Math.max(1, Number(query.get('page') ?? 1)));
      // Expose navigation races while the previous page's metadata is still in state.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        json: {
          briefings: [
            {
              id: `page-${current}`,
              teamAbbr: 'KC',
              category: 'ANALYSIS',
              headline: `Page ${current} development`,
              summary: 'Pagination fixture.',
              updatedAt: '2026-09-24T12:00:00Z',
              sourceCount: 0,
              sources: [],
            },
          ],
          pagination: { page: current, pageSize: 20, totalItems: 60, totalPages: 3 },
        },
      });
    });
    await page.goto('/the-beat?team=KC&sort=NEWEST');
    await expect(page.locator('[data-story-id="page-1"]')).toBeVisible();
    const next = page
      .getByRole('button', { name: 'Next page', exact: true })
      .filter({ visible: true });
    const previous = page
      .getByRole('button', { name: 'Previous page', exact: true })
      .filter({ visible: true });
    await next.click();
    await expect(page.locator('[data-story-id="page-2"]')).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    expect(new URL(page.url()).searchParams.get('sort')).toBe('NEWEST');
    await next.click();
    await expect(page.locator('[data-story-id="page-3"]')).toBeVisible();
    await expect(next).toBeDisabled();
    await previous.click();
    await expect(page.locator('[data-story-id="page-2"]')).toBeVisible();
    if (width === 1440) {
      await page.getByRole('button', { name: 'Page 1', exact: true }).click();
      await expect(page.locator('[data-story-id="page-1"]')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Games', exact: true }).click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page.locator('[data-story-id="page-1"]')).toBeVisible();
    await page.goto('/the-beat?team=KC&page=99&sort=NEWEST');
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator('[data-story-id="page-3"]')).toBeVisible();
  });
}
