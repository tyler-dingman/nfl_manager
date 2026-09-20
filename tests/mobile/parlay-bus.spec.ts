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
for (const width of [390, 1440])
  test(`Science modal and preserved slip at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/parlay-lab/events', (r) =>
      r.fulfill({
        json: {
          events: [
            { id: 'event', homeTeamId: 'KC', awayTeamId: 'DEN', kickoffAt: '2026-09-20T17:00:00Z' },
          ],
        },
      }),
    );
    await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets } }));
    await page.goto('/parlay-lab');
    await expect(page.getByRole('heading', { name: 'Parlay Lab', exact: true })).toBeVisible();
    await expect(page.locator('main > section > section').first()).toHaveAttribute(
      'id',
      'trending-props',
    );
    await expect(page.getByPlaceholder("Let's cook-up a parlay")).toHaveCount(0);
    const trigger = page.getByRole('button', { name: "Let's do Science", exact: true });
    const cta = page.getByRole('link', { name: 'See all trends →' });
    expect(await trigger.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
    expect(await cta.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
    await expect(
      page.locator('#trending-props').getByRole('button', { name: 'Add to slip' }).first(),
    ).toBeVisible();
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: "Let's do Science" });
    await expect(drawer).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(bounds!.height).toBeLessThan(900);
    expect(bounds!.y).toBeGreaterThan(0);
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    await expect(drawer.getByRole('heading', { name: 'Quick Rides' })).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    await drawer.getByRole('button', { name: '3-Legger', exact: true }).click();
    await expect(drawer.getByRole('heading', { name: 'Your Ride' })).toBeVisible();
    await expect(drawer.getByText('ALT LINE', { exact: true })).toHaveCount(3);
    await expect(drawer.getByText(/Works Against Over/)).toHaveCount(3);
    await expect(drawer.getByText(/not win probability|not.*win probability/)).toBeVisible();
    await drawer.getByRole('checkbox', { name: 'Include Charlie' }).uncheck();
    await drawer.getByRole('button', { name: '+ Add', exact: true }).first().click();
    await drawer.getByRole('button', { name: 'Add Ride to My Parlay', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Added', exact: true })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('heading', { name: 'My Parlay 2', exact: true })).toBeVisible();
    await trigger.click();
    await drawer.getByRole('button', { name: "Close Let's do Science" }).click();
    expect(
      requests.filter((url) => url.includes('/api/parlay-lab/') || /sportsgameodds/i.test(url)),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    if (width === 390) {
      await page.getByRole('button', { name: 'Filter', exact: true }).click();
      await expect(page.getByRole('combobox', { name: 'Prop category' })).toBeVisible();
    }
  });
