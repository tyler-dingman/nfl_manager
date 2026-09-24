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
for (const width of [375, 390, 430, 768, 1024, 1280, 1440])
  test(`Parlay creator and preserved slip at ${width}px`, async ({ page }) => {
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
    const trigger = page.getByRole('button', { name: 'Create a Parlay', exact: true });
    const cta = page.getByRole('link', { name: 'See all trends →' });
    expect(await trigger.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
    expect(await cta.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
    await expect(
      page.locator('#trending-props').getByRole('button', { name: 'Add to slip' }).first(),
    ).toBeVisible();
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Create a Parlay' });
    await expect(drawer).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await drawer.getByLabel('Describe your parlay').fill('x'.repeat(510));
    await expect(drawer.getByLabel('Describe your parlay')).toHaveValue('x'.repeat(500));
    await expect(drawer.getByText('500/500', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Optional Settings' }).click();
    await expect(drawer.getByLabel('Max Legs')).toBeHidden();
    await drawer.getByRole('button', { name: 'Optional Settings' }).click();
    await expect(drawer.getByLabel('Max Legs')).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(bounds!.height).toBeLessThan(900);
    expect(bounds!.y).toBeGreaterThan(0);
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    await expect(drawer.getByRole('heading', { name: 'Quick Starts' })).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    await drawer.getByRole('button', { name: '3-Legger', exact: true }).click();
    await expect(drawer.getByRole('button', { name: '3-Legger', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await drawer.getByRole('button', { name: 'Create My Parlay', exact: true }).click();
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
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await expect(page.getByRole('heading', { name: 'My Parlay 2', exact: true })).toBeVisible();
    await trigger.click();
    await drawer.getByRole('button', { name: 'Close Create a Parlay' }).click();
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

test('presets and optional settings use existing research filters', async ({ page }) => {
  const candidates = [
    ...markets,
    ...markets.map((m) => ({
      ...m,
      id: `under-${m.id}`,
      playerName: `Under ${m.playerName}`,
      side: 'UNDER',
      odds: 120,
    })),
    ...markets.map((m) => ({
      ...m,
      id: `td-${m.id}`,
      playerName: `TD ${m.playerName}`,
      marketType: 'ANYTIME_TD',
      statId: 'touchdowns',
      line: 0.5,
      odds: 150,
    })),
    {
      ...markets[0],
      id: 'low-history',
      playerName: 'Low Sample',
      trend: { ...markets[0].trend, trendScore: 99, sampleConfidence: 'LOW' },
    },
  ];
  await page.route('**/api/parlay-lab/events', (r) =>
    r.fulfill({ json: { events: [{ id: 'event', homeTeamId: 'KC', awayTeamId: 'DEN' }] } }),
  );
  await page.route('**/api/parlay-lab/research?**', (r) =>
    r.fulfill({ json: { markets: candidates } }),
  );
  await page.goto('/parlay-lab');
  await page.getByRole('button', { name: 'Create a Parlay', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a Parlay' });
  for (const label of ['3-Legger', 'Plus Money', 'TD Picks', 'High Hit Rate', 'Unders']) {
    await dialog.getByRole('button', { name: label, exact: true }).click();
    await dialog.getByRole('button', { name: 'Create My Parlay', exact: true }).click();
    await expect(dialog.getByRole('checkbox')).toHaveCount(3);
    const legs = dialog.locator('article');
    if (label === 'Plus Money')
      await expect(legs.filter({ hasText: /\+120|\+150/ })).toHaveCount(3);
    if (label === 'TD Picks') await expect(legs.filter({ hasText: /anytime td/ })).toHaveCount(3);
    if (label === 'Unders') await expect(legs.filter({ hasText: /U 200.5/ })).toHaveCount(3);
    if (label === 'High Hit Rate')
      await expect(legs.filter({ hasText: 'Low Sample' })).toHaveCount(0);
  }
  await dialog.getByLabel('Describe your parlay').fill('Build a 3-leg parlay');
  await dialog.getByLabel('Risk Level').selectOption('high');
  await dialog.getByLabel('Max Legs').selectOption('2');
  await dialog.getByRole('button', { name: 'Create My Parlay', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  await expect(dialog.locator('article').filter({ hasText: 'Low Sample' })).toHaveCount(0);
});

test('market loading, empty state and retry keep the request editable', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let mode = 'loading';
  await page.route('**/api/parlay-lab/events', (r) =>
    r.fulfill({ json: { events: [{ id: 'event', homeTeamId: 'KC', awayTeamId: 'DEN' }] } }),
  );
  await page.route('**/api/parlay-lab/research?**', async (r) => {
    if (mode === 'loading') await pending;
    await r.fulfill(
      mode === 'error'
        ? { status: 503, json: { error: 'Unavailable' } }
        : { json: { markets: mode === 'ready' ? markets : [] } },
    );
  });
  await page.goto('/parlay-lab');
  const trigger = page.getByRole('button', { name: 'Create a Parlay', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Create a Parlay' });
  await expect(dialog.getByRole('button', { name: 'Loading available markets…' })).toBeDisabled();
  await dialog.getByLabel('Describe your parlay').fill('Build a 3-leg parlay');
  mode = 'empty';
  release();
  await expect(dialog.getByText(/There aren’t enough eligible markets/)).toBeVisible();
  mode = 'error';
  await page.reload();
  await trigger.click();
  await expect(dialog.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  mode = 'ready';
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await dialog.getByRole('button', { name: '3-Legger', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Create My Parlay', exact: true })).toBeEnabled();
});
