import { test, expect } from '@playwright/test';
test('Teams uses Games research without changing favorite', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1000 });
  await page.addInitScript(() => {
    if (!localStorage.getItem('down-distance-fan-team'))
      localStorage.setItem('down-distance-fan-team', 'ARI');
  });
  await page.route('**/api/user/home', (r) =>
    r.fulfill({ json: { personalization: { primaryTeam: { teamId: 'ARI' } } } }),
  );
  await page.route('**/api/parlay-lab/events', (r) =>
    r.fulfill({
      json: {
        events: [
          {
            id: 'ari',
            homeTeamId: 'SF',
            awayTeamId: 'ARI',
            week: 4,
            kickoffAt: '2099-10-01T23:00:00Z',
          },
          {
            id: 'buf',
            homeTeamId: 'BUF',
            awayTeamId: 'KC',
            week: 4,
            kickoffAt: '2099-10-02T23:00:00Z',
          },
        ],
      },
    }),
  );
  await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets: [] } }));
  await page.route('**/api/parlay-lab/events/*/markets', (r) =>
    r.fulfill({ json: { markets: [] } }),
  );
  await page.route('**/api/parlay-lab/movement', (r) => r.fulfill({ json: { movements: [] } }));
  await page.goto('/parlay-lab/games');
  await expect(page).toHaveURL(/games\?team=ARI/);
  await page
    .getByRole('navigation', { name: 'Parlay Lab', exact: true })
    .getByRole('link', { name: 'Teams', exact: true })
    .click();
  await expect(page).toHaveURL(/games\?team=ARI/);
  await expect(page.getByLabel('Research team')).toHaveValue('ARI');
  await expect(page.locator('.lab-schedule button[aria-pressed="true"]')).toContainText('ARI @ SF');
  await page.getByLabel('Research team').selectOption('BUF');
  await expect(page).toHaveURL(/games\?team=BUF/);
  await expect(page.locator('.lab-schedule button[aria-pressed="true"]')).toContainText('KC @ BUF');
  expect(await page.evaluate(() => localStorage.getItem('down-distance-fan-team'))).toBe('ARI');
  await page.reload();
  await expect(page.getByLabel('Research team')).toHaveValue('BUF');
  await expect(page.locator('.lab-schedule button[aria-pressed="true"]')).toContainText('KC @ BUF');
  await page.locator('.lab-schedule button').filter({ hasText: 'ARI @ SF' }).click();
  await expect(page.locator('.lab-schedule button[aria-pressed="true"]')).toContainText('ARI @ SF');
  await expect(page.getByLabel('Research team')).toHaveValue('BUF');
  await page.screenshot({ path: 'artifacts/lab-research-team.png' });
  await page
    .getByRole('navigation', { name: 'Parlay Lab', exact: true })
    .getByRole('link', { name: 'Teams', exact: true })
    .click();
  await expect(page).toHaveURL(/games\?team=ARI/);
  await page.goto('/parlay-lab/teams?team=BUF');
  await expect(page).toHaveURL(/games\?team=BUF/);
});
