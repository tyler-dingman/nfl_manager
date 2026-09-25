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
    trendScore: 91 - i * 2,
    last10: { games: 10, hits: 8, hitRate: 80 },
    last5: { games: 5, hits: 4, hitRate: 80 },
    streakType: 'HIT',
    streakLength: 3,
    recentAverage10: 240,
    sampleConfidence: 'HIGH',
  },
}));

for (const width of [390, 1440])
  test(`Parlay hero at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let researchOpened = false;
    const all = [
      ...markets,
      {
        ...markets[0],
        id: 'duplicate',
        normalizedKey: 'duplicate',
        trend: { ...markets[0].trend, trendScore: 90 },
      },
      ...markets.map((m) => ({
        ...m,
        id: m.id + 'lac',
        normalizedKey: m.normalizedKey + 'lac',
        teamId: 'LAC',
      })),
    ];
    await page.route('**/api/parlay-lab/events', (r) =>
      r.fulfill({
        json: {
          events: [
            { id: 'event', homeTeamId: 'KC', awayTeamId: 'LAC', kickoffAt: '2099-10-01T23:00:00Z' },
          ],
        },
      }),
    );
    await page.route('**/api/parlay-lab/research?**', (r) => {
      if (new URL(r.request().url()).searchParams.has('playerId')) {
        researchOpened = true;
        return r.fulfill({ status: 503, json: {} });
      }
      return r.fulfill({ json: { markets: all } });
    });
    for (const team of ['KC', 'LAC']) {
      await page.goto(`/parlay-lab?team=${team}`);
      const hero = page.locator('[data-editorial-hero="parlay-lab"]');
      await expect(hero.locator('li')).toHaveCount(3);
      const text = await hero.locator('li').allTextContents();
      expect(text[0]).toContain('Alpha');
      expect(text[1]).toContain('Bravo');
      expect(text[2]).toContain('Charlie');
      expect(text[0]).toContain('91');
      expect(text[1]).toContain('89');
      expect(text[2]).toContain('87');
      await expect(hero.locator('h1 span')).toHaveCSS(
        'color',
        team === 'KC' ? 'rgb(255, 21, 60)' : 'rgb(0, 128, 198)',
      );
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      if (team === 'KC') await hero.screenshot({ path: `artifacts/parlay-hero-${width}.png` });
      await hero.locator('li button').first().click();
      await expect.poll(() => researchOpened).toBe(true);
    }
  });
