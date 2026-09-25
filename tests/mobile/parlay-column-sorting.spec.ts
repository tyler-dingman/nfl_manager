import { test, expect } from '@playwright/test';
test('prop and player columns sort full results in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1000 });
  const markets = Array.from({ length: 16 }, (_, i) => ({
    id: `m${i}`,
    normalizedKey: `m${i}`,
    eventId: 'event',
    playerId: `p${i}`,
    playerName: `Player ${String(i).padStart(2, '0')}`,
    teamId: i % 2 ? 'BUF' : 'KC',
    position: i % 2 ? 'RB' : 'QB',
    marketType: i % 2 ? 'RUSHING_YARDS' : 'PASSING_YARDS',
    statId: 'yards',
    period: 'game',
    side: 'OVER',
    line: i + 1,
    odds: i === 15 ? null : -200 + i * 5,
    sportsbook: 'FANDUEL',
    available: true,
    trend: {
      trendScore: 99 - i,
      last10: { games: 10, hits: 8, hitRate: 80 },
      gameLog: [],
      streakLength: i,
      streakType: 'HIT',
      recentAverage10: 20,
      sampleConfidence: 'HIGH',
    },
  }));
  await page.route('**/api/parlay-lab/events', (r) =>
    r.fulfill({
      json: {
        events: [
          { id: 'event', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-10-01T23:00:00Z' },
        ],
      },
    }),
  );
  await page.route('**/api/parlay-lab/research?**', (r) => r.fulfill({ json: { markets } }));
  await page.route('**/api/parlay-lab/players', (r) => r.fulfill({ json: { players: [] } }));
  await page.route('**/api/parlay-lab/movement', (r) => r.fulfill({ json: { movements: [] } }));
  await page.goto('/parlay-lab/trends?team=KC');
  const table = page.locator('.lab-props');
  await expect(table.locator('tbody tr')).toHaveCount(12);
  const line = table.getByRole('columnheader', { name: 'Line', exact: true });
  await line.getByRole('button').click();
  await expect(line).toHaveAttribute('aria-sort', 'ascending');
  await expect(table.locator('tbody tr').first()).toContainText('Player 00');
  await line.getByRole('button').click();
  await expect(line).toHaveAttribute('aria-sort', 'descending');
  await expect(table.locator('tbody tr').first()).toContainText('Player 15');
  const odds = table.getByRole('columnheader', { name: 'Odds', exact: true });
  await odds.getByRole('button').click();
  await expect(table.locator('tbody tr').first()).toContainText('Player 00');
  await odds.getByRole('button').click();
  await expect(table.locator('tbody tr').first()).toContainText('Player 14');
  for (const header of await table
    .locator('th')
    .filter({ has: page.locator('button') })
    .all()) {
    const before = await header.getAttribute('aria-sort');
    await header.getByRole('button').click();
    await expect(header).not.toHaveAttribute('aria-sort', before!);
  }
  await page.goto('/parlay-lab/players?team=KC');
  const directory = page.locator('#player-directory');
  await expect(directory.locator('tbody tr')).toHaveCount(16);
  const player = directory.getByRole('columnheader', { name: 'PLAYER', exact: true });
  await player.getByRole('button').click();
  await expect(directory.locator('tbody tr').first()).toContainText('Player 00');
  await player.getByRole('button').click();
  await expect(directory.locator('tbody tr').first()).toContainText('Player 15');
  const team = directory.getByRole('columnheader', { name: 'TEAM', exact: true });
  await team.getByRole('button').click();
  await expect(directory.locator('tbody tr').first()).toContainText('BUF');
  await team.getByRole('button').click();
  await expect(directory.locator('tbody tr').first()).toContainText('KC');
  await page.getByLabel('Sort players', { exact: true }).selectOption('Name');
  await expect(player).toHaveAttribute('aria-sort', 'none');
  await expect(directory.locator('tbody tr').first()).toContainText('Player 00');
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await directory
    .getByRole('columnheader', { name: 'HIT RATE', exact: true })
    .getByRole('button')
    .click();
  await expect(
    directory.getByRole('columnheader', { name: 'HIT RATE', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
});
