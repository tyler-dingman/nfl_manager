import { test, expect } from '@playwright/test';

for (const route of ['/trivia', '/merch', '/rewards', '/parlay-lab']) {
  test(`${route} fits all supported mobile widths`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('main').first()).toBeVisible();
    for (const width of [320, 360, 375, 390, 393, 414, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    }
  });
}

test('mobile menu and cart contain focus and restore scrolling', async ({ page }) => {
  await page.goto('/merch');
  const menuButton = page.getByRole('button', { name: 'Open menu', exact: true });
  await menuButton.click();
  const menu = page.getByRole('dialog', { name: 'Site menu' });
  await expect(menu.getByRole('link', { name: 'Trivia', exact: true })).toBeVisible();
  await expect(menu).toHaveCSS('background-color', /rgb\(\d+, \d+, \d+\)/);
  const menuColors = await menu.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, text: styles.color };
  });
  expect(menuColors.text).not.toBe(menuColors.background);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  const cartButton = page.getByRole('button', { name: /Open shopping bag/ });
  await cartButton.click();
  const cart = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(cart).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Shift+Tab');
  expect(await cart.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(cart).toHaveCount(0);
  await expect(cartButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('video dialog remains usable in phone landscape', async ({ page }) => {
  await page.route('**/api/film-room?*', (route) =>
    route.fulfill({
      json: {
        teamId: 'CHI',
        configured: true,
        unavailableVideoIds: [],
        videos: [
          {
            id: 'mobile-layout-fixture',
            category: 'film-room',
            score: 1,
            addedAt: '2026-09-18',
            title: 'Mobile layout fixture',
            description: 'Film description. '.repeat(120),
            thumbnail: '/assets/nfc_logo.svg',
            duration: '10:00',
            publishedAt: '2026-09-18',
            viewCount: 100,
            channel: { id: 'fixture', name: 'Fixture channel', avatar: null, subscriberCount: 100 },
            youtubeUrl: '#',
            embedUrl: 'about:blank',
            channelUrl: '#',
          },
        ],
      },
    }),
  );
  await page.goto('/watch?team=CHI');
  await page.getByRole('button', { name: 'Play Mobile layout fixture' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeGreaterThan(600);
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(dialog.getByRole('button', { name: 'Close video player' })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Close video player' }).click();
  await expect(dialog).toHaveCount(0);
});
