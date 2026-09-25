import { expect, test } from '@playwright/test';
const teams = ['HOU', 'KC', 'CAR', 'BUF', 'PHI', 'DET', 'SF', 'GB'];
for (const width of [390, 1440]) {
  test(`Next Up follows selected teams and centers with hero at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    let empty = false;
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost') return route.continue();
      const team = url.searchParams.get('team') || 'HOU';
      const game = {
        id: `upcoming-${team}`,
        season: 2027,
        seasonType: 'REG',
        week: 3,
        homeTeam: team,
        awayTeam: 'CIN',
        kickoffAt: '2027-09-26T17:00:00Z',
        kickoffConfirmed: true,
        status: 'SCHEDULED',
        venue: 'Canonical Test Stadium',
        homeScore: null,
        awayScore: null,
      };
      return route.fulfill({
        json:
          url.pathname === '/api/content/next-game'
            ? { game: empty ? null : game }
            : { game: null, huddle: [], wire: [], items: [], videos: [], user: null },
      });
    });
    await page.goto('/');
    for (const team of teams) {
      await page.evaluate((team) => localStorage.setItem('down-distance-fan-team', team), team);
      await page.reload();
      const card = page.locator('[data-next-game-card]');
      await expect(card).toContainText('WEEK 3');
      await expect(card).toContainText('SUN, SEP 26 · 1:00 PM ET');
      await expect(card).toContainText('Canonical Test Stadium');
      await expect(card.locator('[data-matchup-team]').nth(0)).toHaveAttribute(
        'data-matchup-team',
        'CIN',
      );
      await expect(card.locator('[data-matchup-team]').nth(1)).toHaveAttribute(
        'data-matchup-team',
        team,
      );
      await expect(card.locator('img')).toHaveCount(2);
      await page.evaluate(() => document.fonts.ready);
      const left = (await page.locator('[data-hero-copy]').boundingBox())!;
      const right = (await card.boundingBox())!;
      if (width >= 1024) {
        expect(Math.abs(left.y + left.height / 2 - right.y - right.height / 2)).toBeLessThan(2);
        expect(right.x).toBeGreaterThan(left.x + left.width);
      } else expect(right.y).toBeGreaterThan(left.y + left.height);
      expect(right.x + right.width).toBeLessThanOrEqual(width);
      if (team === 'HOU')
        await card
          .locator('xpath=ancestor::section[1]')
          .screenshot({ path: `artifacts/next-game-hero-${width}.png` });
    }
    empty = true;
    await page.reload();
    const card = page.locator('[data-next-game-card]');
    await expect(card).toContainText('Schedule coming soon.');
    await expect(card.locator('img')).toHaveCount(0);
  });
}

test('canonical next game endpoint returns upcoming scheduled games for selected teams', async ({
  request,
}) => {
  for (const team of teams) {
    const response = await request.get(`/api/content/next-game?team=${team}`);
    expect(response.ok(), team).toBeTruthy();
    const { game } = await response.json();
    if (game) {
      expect([game.homeTeam, game.awayTeam]).toContain(team);
      expect(game.status).toBe('SCHEDULED');
      expect(Date.parse(game.kickoffAt)).toBeGreaterThan(Date.now());
    }
    console.log(
      team,
      game
        ? `${game.awayTeam} at ${game.homeTeam}, ${game.kickoffAt}`
        : 'No future schedule stored',
    );
  }
});
