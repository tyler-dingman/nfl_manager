import { test, expect } from '@playwright/test';

const markets = ['Alpha', 'Bravo', 'Charlie'].map((name, i) => ({
  id: `ride-${i}`,
  normalizedKey: `ride-${i}`,
  eventId: 'event',
  playerId: `p${i}`,
  playerName: name,
  teamId: 'KC',
  position: 'QB',
  marketType: 'PASSING_YARDS',
  statId: 'passing_yards',
  entityId: `p${i}`,
  period: 'game',
  side: 'OVER',
  line: 200.5,
  sportsbook: 'FANDUEL',
  odds: -110,
  available: true,
  isAltLine: true,
  lineType: 'alternate',
  mainLine: 250.5,
  deeplink: null,
  matchup: {
    opponentId: 'DEN',
    rank: 1,
    label: 'Pass D',
    season: 2025,
    alignment: 'conflicts',
    explanation: 'Works Against Over',
  },
  trend: {
    trendScore: 80,
    last10: { games: 10, hits: 8, hitRate: 80 },
    last5: { games: 5, hits: 4, hitRate: 80 },
    streakType: 'HIT',
    streakLength: 3,
    recentAverage10: 240,
    sampleConfidence: 'HIGH',
  },
}));

for (const width of [390, 1536])
  test(`dashboard routes and shared build at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.addInitScript(() => localStorage.setItem('down-distance-fan-team', 'KC'));
    const games = [
      {
        id: 'event',
        homeTeamId: 'KC',
        awayTeamId: 'DEN',
        week: 4,
        kickoffAt: '2099-10-01T23:00:00Z',
      },
      {
        id: 'other',
        homeTeamId: 'BUF',
        awayTeamId: 'LAC',
        week: 4,
        kickoffAt: '2099-10-02T23:00:00Z',
      },
    ];
    const all = [
      ...markets,
      ...markets.map((m) => ({
        ...m,
        id: m.id + 'other',
        normalizedKey: m.normalizedKey + 'other',
        playerId: m.playerId + 'other',
        playerName: m.playerName + ' Other',
        eventId: 'other',
        teamId: 'BUF',
      })),
    ];
    await page.route('**/api/parlay-lab/events', (r) => r.fulfill({ json: { events: games } }));
    await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets: all } }));
    await page.route('**/api/parlay-lab/events/*/markets', (r) =>
      r.fulfill({ json: { markets: [] } }),
    );
    await page.route('**/api/content/next-game?**', (r) => r.fulfill({ json: { game: null } }));
    await page.route('**/api/parlay-lab/movement', (r) => r.fulfill({ json: { movements: [] } }));
    await page.route('**/api/parlay-lab/players', (r) =>
      r.fulfill({
        json: {
          players: markets.map((m) => ({
            id: m.playerId,
            name: m.playerName,
            teamAbbr: m.teamId,
            position: m.position,
            headshotUrl: null,
          })),
        },
      }),
    );
    await page.goto('/parlay-lab?team=KC');
    await expect(page.locator('.lab-props tbody tr')).toHaveCount(5);
    await page
      .locator('.lab-props')
      .getByRole('button', { name: 'Add Alpha to parlay', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('down-distance-parlay-lab-current') ?? '[]').length,
        ),
      )
      .toBe(1);
    await page.screenshot({ path: `artifacts/lab-home-${width}.png`, fullPage: true });
    await page.goto('/parlay-lab/trends?team=KC');
    await expect(page.locator('.lab-props tbody tr')).toHaveCount(6);
    await page.getByLabel('My Team Only').check();
    await expect(page.locator('.lab-props tbody tr')).toHaveCount(3);
    await expect(
      page.locator('.lab-props').getByRole('button', { name: 'Add Alpha to parlay', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: `artifacts/lab-trends-${width}.png`, fullPage: true });
    await page.goto('/parlay-lab/games?team=KC');
    await expect(page.locator('.lab-props tbody tr')).toHaveCount(3);
    await page.locator('.lab-schedule button').filter({ hasText: 'LAC @ BUF' }).click();
    await expect(page.locator('.lab-props tbody')).toContainText('Alpha Other');
    await page.screenshot({ path: `artifacts/lab-games-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    for (const route of ['players', 'teams', 'generator', 'my-plays', 'settings']) {
      await page.goto(`/parlay-lab/${route}?team=KC`);
      await expect(page.locator('[data-parlay-dashboard]')).toBeVisible();
      await expect(page.locator('.lab-workspace')).not.toBeEmpty();
      if (route === 'generator') {
        await expect(page.getByLabel('Ask the Lab', { exact: true })).toBeVisible();
        await expect(
          page.getByRole('button', { name: '3 legs · strongest signals', exact: true }),
        ).toBeVisible();
      }
      if (route === 'players')
        await expect(page.locator('#player-directory tbody tr')).toHaveCount(6);
      if (route === 'teams') await expect(page.getByLabel('Research team')).toHaveValue('KC');
    }
  });
