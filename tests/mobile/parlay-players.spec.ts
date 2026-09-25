import { test, expect } from '@playwright/test';
const markets = ['Patrick Mahomes', 'Ja’Marr Chase', 'Josh Allen'].map((name, i) => ({
  id: `player-market-${i}`,
  normalizedKey: `player-market-${i}`,
  eventId: 'event',
  playerId: `p${i}`,
  playerName: name,
  teamId: ['KC', 'CIN', 'BUF'][i],
  position: i === 1 ? 'WR' : 'QB',
  marketType: 'PASSING_YARDS',
  statId: 'passing_yards',
  entityId: `p${i}`,
  period: 'game',
  side: 'OVER',
  line: 249.5,
  sportsbook: 'FANDUEL',
  odds: -110,
  available: true,
  lineType: 'main',
  headshotUrl: null,
  trend: {
    trendScore: 93 - i,
    last10: { games: 10, hits: 9 - i, hitRate: 90 - i * 10 },
    last5: { games: 5, hits: 5, hitRate: 100 },
    streakType: 'HIT',
    streakLength: 5,
    recentAverage10: 270,
    sampleConfidence: 'HIGH',
    gameLog: Array.from({ length: 10 }, (_, j) => ({
      date: `2026-09-${String(20 - j).padStart(2, '0')}`,
      opponent: 'DEN',
      homeAway: 'HOME',
      statValue: j < 9 - i ? 300 : 200,
      line: 249.5,
      result: j < 9 - i ? 'HIT' : 'MISS',
    })),
  },
}));
for (const width of [390, 1536])
  test(`Players research at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.addInitScript(
      (legs) => {
        localStorage.setItem('down-distance-fan-team', 'KC');
        localStorage.setItem('down-distance-parlay-lab-current', JSON.stringify(legs));
      },
      [markets[0]],
    );
    await page.route('**/api/parlay-lab/events', (r) =>
      r.fulfill({
        json: {
          events: [
            {
              id: 'event',
              homeTeamId: 'KC',
              awayTeamId: 'CIN',
              week: 4,
              kickoffAt: '2099-10-01T23:00:00Z',
            },
          ],
        },
      }),
    );
    await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets } }));
    await page.route('**/api/parlay-lab/players', (r) =>
      r.fulfill({
        json: {
          players: [
            ...markets.map((m) => ({
              id: m.playerId,
              name: m.playerName,
              position: m.position,
              teamAbbr: m.teamId,
              headshotUrl: null,
            })),
            {
              id: 'inactive',
              name: 'Unresearchable Player',
              teamAbbr: 'KC',
              position: 'QB',
              headshotUrl: null,
            },
          ],
        },
      }),
    );
    await page.goto('/parlay-lab/players?team=KC');
    const rows = page.locator('#player-directory tbody tr');
    await expect(rows).toHaveCount(3);
    const hero = page.getByRole('region', { name: 'Player discovery' });
    await expect(hero.locator('article')).toHaveCount(3);
    await expect(hero).not.toContainText('249.5');
    await expect(page.locator('#player-directory')).not.toContainText('249.5');
    await expect(rows.first()).toContainText('90%');
    await page.getByLabel('Search players', { exact: true }).fill('Mahomes');
    await expect(rows).toHaveCount(1);
    await page.getByLabel('Search players', { exact: true }).fill('');
    await page.getByLabel('Team', { exact: true }).selectOption('CIN');
    await expect(rows).toHaveCount(1);
    await page.getByLabel('Team', { exact: true }).selectOption('ALL');
    await page.getByLabel('Position', { exact: true }).selectOption('QB');
    await expect(rows).toHaveCount(2);
    await page.getByLabel('Position', { exact: true }).selectOption('ALL');
    await page.getByLabel('My Team Only').check();
    await expect(rows).toHaveCount(1);
    await page.getByLabel('My Team Only').uncheck();
    await page.screenshot({ path: `artifacts/lab-players-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.getByRole('button', { name: 'Remove Patrick Mahomes', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('down-distance-parlay-lab-current') || '[]').length,
        ),
      )
      .toBe(0);
    await page.getByRole('button', { name: 'View Patrick Mahomes', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
