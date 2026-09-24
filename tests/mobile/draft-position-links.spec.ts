import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`Team Needs position links filter actual prospect rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() => {
      localStorage.setItem(
        'nfl-manager-save',
        JSON.stringify({
          version: 0,
          state: {
            saveId: 'position-filter-fixture',
            teamId: 'nyj',
            teamAbbr: 'NYJ',
            franchiseYear: 2026,
            phase: 'scouting_combine',
            roster: [],
            capSpace: 40,
            unlocked: { draft: true, freeAgency: true },
          },
        }),
      );
    });
    const prospects = ['OT', 'LT', 'DL', 'DT', 'WR'].map((position, i) => ({
      id: `filter-${position}`,
      name: `${position} Prospect`,
      position,
      school: 'Test School',
      ranking: i + 1,
      currentRank: i + 1,
      grade: '90',
    }));
    await page.route('**/api/**', (route) =>
      route.fulfill({ json: { ok: true, state: null, events: [] } }),
    );
    await page.route('**/api/front-office/draft-central?*', (route) =>
      route.fulfill({
        json: {
          prospects,
          recommendations: [],
          needAnalysis: ['OT', 'DL'].map((position, i) => ({
            position,
            level: 'High',
            score: 90,
            rank: i + 1,
            factors: [],
            starters: 0,
            requiredStarters: 2,
            keyDepth: 0,
            averageAge: null,
            expiringContracts: 0,
          })),
        },
      }),
    );
    const playerNames = page.locator('button[class*="playerCell"] b');
    for (const [position, names] of [
      ['OT', ['OT Prospect', 'LT Prospect']],
      ['DL', ['DL Prospect', 'DT Prospect']],
    ] as const) {
      await page.goto('/front-office/draft/team-needs');
      await page.getByRole('link', { name: `View ${position} prospects`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`position=${position}$`));
      await expect(page.getByLabel('Prospect position')).toHaveValue(position);
      await expect(playerNames).toHaveText([...names]);
      await page.reload();
      await expect(playerNames).toHaveText([...names]);
      await page.getByLabel('Prospect position').selectOption('ALL');
      await expect(playerNames).toHaveCount(5);
    }
  });
}
