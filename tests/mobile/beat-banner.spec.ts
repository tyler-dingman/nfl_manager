import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`homepage has three stories then banner; Beat has no ad at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const stories = Array.from({ length: 4 }, (_, i) => ({
      id: `story-${i}`,
      teamAbbr: 'CHI',
      category: 'ANALYSIS',
      headline: `Development ${i}`,
      summary: 'Banner placement fixture.',
      updatedAt: '2026-09-24T12:00:00Z',
      sourceCount: 0,
      sources: [],
    }));
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost') return route.continue();
      return route.fulfill({
        json: {
          game: null,
          huddle: stories,
          briefings: stories,
          wire: [],
          videos: [],
          items: [],
          user: null,
          pagination: { page: 1, pageSize: 20, totalItems: 4, totalPages: 1 },
        },
      });
    });
    await page.addInitScript(() => localStorage.setItem('down-distance-fan-team', 'CHI'));
    await page.goto('/');
    const section = page.locator('#huddle');
    const cards = section.locator('[data-story-id]');
    const ad = section.getByRole('complementary', { name: 'Advertisement' });
    await expect(cards).toHaveCount(3);
    await expect(ad).toHaveCount(1);
    expect(await ad.evaluate((el) => Array.from(el.parentElement!.children).indexOf(el))).toBe(3);
    const metrics = await ad.evaluate((el) => ({
      ad: el.getBoundingClientRect().width,
      grid: el.parentElement!.getBoundingClientRect().width,
    }));
    expect(Math.abs(metrics.ad - metrics.grid)).toBeLessThan(1);
    await expect(ad.locator('img')).toHaveJSProperty('naturalWidth', 1002);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.goto('/the-beat?team=CHI');
    await expect(page.locator('#beat-feed-start [data-story-id]')).toHaveCount(4);
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toHaveCount(0);
  });
}
