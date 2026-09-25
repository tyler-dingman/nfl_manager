import { test, expect } from '@playwright/test';
const markets = Array.from({ length: 6 }, (_, i) => ({
  id: `m${i}`,
  normalizedKey: `m${i}`,
  eventId: 'event',
  playerId: `p${i}`,
  playerName: [
    'Patrick Mahomes',
    'Travis Kelce',
    'Isiah Pacheco',
    'Josh Allen',
    'James Cook',
    'Khalil Shakir',
  ][i],
  teamId: i < 3 ? 'KC' : 'BUF',
  position: i === 1 ? 'TE' : i % 3 === 0 ? 'QB' : 'RB',
  marketType: 'RUSHING_YARDS',
  statId: 'rushing_yards',
  entityId: `p${i}`,
  period: 'game',
  side: 'OVER',
  line: 50.5,
  sportsbook: 'FANDUEL',
  odds: -110,
  available: true,
  trend: {
    trendScore: 95 - i * 3,
    last10: { games: 10, hits: 8, hitRate: 80 },
    last5: { games: 5, hits: 4, hitRate: 80 },
    streakType: 'HIT',
    streakLength: 3,
    recentAverage10: 65,
    sampleConfidence: 'HIGH',
    gameLog: [],
  },
}));
for (const width of [1536, 390])
  test(`Generator prompt and shared build at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('down-distance-fan-team', 'KC');
      localStorage.removeItem('down-distance-parlay-lab-current');
    });
    await page.route('**/api/user/home', (r) =>
      r.fulfill({ json: { personalization: { primaryTeam: { teamId: 'KC' } } } }),
    );
    await page.route('**/api/parlay-lab/events', (r) =>
      r.fulfill({
        json: {
          events: [
            {
              id: 'event',
              homeTeamId: 'KC',
              awayTeamId: 'BUF',
              week: 4,
              kickoffAt: '2099-10-01T23:00:00Z',
            },
          ],
        },
      }),
    );
    await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets } }));
    await page.goto('/parlay-lab/generator?team=KC');
    const input = page.getByLabel('Ask the Lab', { exact: true });
    await input.fill('4 leg parlay with -200 odds and all legs 80 Lab Score or higher');
    await page.getByRole('button', { name: 'Generate parlay', exact: true }).click();
    await expect(page.getByText('4 LEGS · +1228', { exact: true })).toBeVisible();
    await expect(page.getByText('Every Lab Score ≥ 86', { exact: false })).toBeVisible();
    await page.screenshot({ path: `artifacts/lab-generator-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.getByRole('button', { name: 'Add All to My Parlay →', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('down-distance-parlay-lab-current') || '[]').length,
        ),
      )
      .toBe(4);
    await expect(
      page.getByRole('button', { name: 'Added to My Parlay', exact: true }),
    ).toBeDisabled();
    await input.fill('5 legs all Lab Scores at least 99');
    await page.getByRole('button', { name: 'Generate parlay', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'No matching parlay', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Only 0');
    await page.getByRole('button', { name: 'Build around my team', exact: true }).click();
    await expect(page.getByText('3 LEGS · +596', { exact: true })).toBeVisible();
    await expect(page.locator('blockquote')).toContainText('my team');
    await expect(page.getByRole('heading', { name: 'Recent Searches' })).toBeVisible();
  });
