import { test, expect } from '@playwright/test';
test('Trending hero shows the top three saved player prop scores', async ({ page }) => {
  const markets = [72, 95, 81, 90].map((score, i) => ({
    id: `m${i}`,
    normalizedKey: `m${i}`,
    eventId: 'event',
    playerId: `p${i}`,
    playerName: `Player ${i}`,
    teamId: 'KC',
    side: 'OVER',
    line: 20.5,
    marketType: 'PASSING_YARDS',
    statId: 'passing_yards',
    entityId: `p${i}`,
    position: 'QB',
    headshotUrl: null,
    period: 'game',
    available: true,
    odds: -110,
    sportsbook: 'FANDUEL',
    trend: {
      gameLog: [],
      trendScore: score,
      last10: { games: 10, hits: 8, hitRate: 80 },
      last5: { games: 5, hits: 4, hitRate: 80 },
      recentAverage10: 240,
      sampleConfidence: 'HIGH',
      streakLength: 0,
      streakType: null,
    },
  }));
  markets.push({
    ...markets[1],
    id: 'duplicate-player-prop',
    normalizedKey: 'duplicate-player-prop',
    marketType: 'RUSHING_ATTEMPTS',
    trend: { ...markets[1].trend, trendScore: 94 },
  });
  await page.route('**/api/parlay-lab/events', (r) =>
    r.fulfill({
      json: {
        events: [
          { id: 'event', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
        ],
      },
    }),
  );
  await page.route('**/api/parlay-lab/research?**', (r) =>
    new URL(r.request().url()).searchParams.has('playerId')
      ? r.fulfill({ status: 503, json: { error: 'Detail fixture unavailable' } })
      : r.fulfill({ json: { markets } }),
  );
  await page.route('**/api/parlay-lab/movement', (r) => r.fulfill({ json: { movements: [] } }));
  await page.goto('/parlay-lab/trends?team=KC');
  const cards = page.locator('.lab-spotlight-prop');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('.lab-score')).toHaveText(['95', '90', '81']);
  await expect(cards.locator('b')).toHaveText(['Player 1', 'Player 3', 'Player 2']);
  await expect(cards.first()).toContainText('Passing Yards');
  await expect(page.locator('.lab-props')).toContainText('Rushing Attempts');
  await expect(page.locator('.lab-props')).not.toContainText('RUSHING ATTEMPTS');
  for (const width of [1536, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await cards.first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
