import { expect, test } from '@playwright/test';

test('mobile Change team opens repeatedly on home and after navigating from The Beat', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('down-distance-fan-team', 'LAC'));
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).hostname !== 'localhost') return route.continue();
    return route.fulfill({
      json: {
        user: null,
        game: null,
        huddle: [],
        briefings: [],
        videos: [],
        wire: [],
        items: [],
        unavailableVideoIds: [],
      },
    });
  });
  const changeTeam = async () => {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('link', { name: 'Change team', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Pick your team. Enter your football world.' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Site menu' })).toHaveCount(0);
    await expect(page).not.toHaveURL(/team-select=1/);
  };
  await page.goto('/');
  await changeTeam();
  await page.getByRole('button', { name: 'Kansas City Chiefs', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('down-distance-fan-team')))
    .toBe('KC');
  await expect(page.locator('[data-home-team-headline]')).toContainText('Chiefs');
  await changeTeam();
  await page.getByRole('button', { name: 'Close team selection' }).click();
  await changeTeam();
  await page.getByRole('button', { name: 'Detroit Lions', exact: true }).click();
  await expect(page.locator('[data-home-team-headline]')).toContainText('Pride');
  await page.goto('/the-beat?team=DET');
  await changeTeam();
  await page.getByRole('button', { name: 'Buffalo Bills', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('down-distance-fan-team')))
    .toBe('BUF');
  await expect(page.locator('[data-home-team-headline]')).toContainText('Mafia');
});
