import { expect, test } from '@playwright/test';
import { TEAM_LIST } from '../../src/data/teams';

for (const width of [390, 1536]) {
  test(`Front Office start design and experience actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.addInitScript(() =>
      localStorage.setItem(
        'nfl-manager-save',
        JSON.stringify({
          version: 0,
          state: {
            saveId: 'start-screen-fixture',
            teamId: 'mia',
            teamAbbr: 'MIA',
            franchiseYear: 2026,
            phase: 'resign_cut',
            roster: [],
            capSpace: 40,
            capLimit: 300,
            unlocked: { draft: false, freeAgency: false },
          },
        }),
      ),
    );
    const choices: unknown[] = [];
    const starts: unknown[] = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      if (new URL(request.url()).hostname !== 'localhost') return route.continue();
      if (request.url().includes('/api/front-office/state') && request.method() === 'PUT')
        choices.push(request.postDataJSON());
      if (request.url().includes('/api/front-office/simulate')) {
        starts.push(request.postDataJSON());
        return route.fulfill({
          status: 503,
          json: { error: 'Fixture: initialization temporarily unavailable' },
        });
      }
      return route.fulfill({ json: { ok: true, state: null, events: [] } });
    });
    await page.goto('/experience');
    await expect(
      page.getByRole('heading', { name: 'Take control of the Dolphins.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'The franchise lifecycle' })).toBeVisible();
    if (width > 1100) {
      await expect(
        page.getByRole('navigation', { name: 'Front Office', exact: true }).getByRole('link'),
      ).toHaveText(['Start', 'Settings']);
      await expect(page.getByRole('link', { name: 'Start', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(
        page.getByRole('link', { name: 'FanDuel sportsbook advertisement' }),
      ).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Front Office navigation: Start' }).click();
      await expect(
        page
          .getByRole('dialog', { name: 'Franchise navigation' })
          .getByRole('link', { name: 'Start', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images]
          .filter((img) => img.getBoundingClientRect().width > 0)
          .map((img) => {
            img.loading = 'eager';
            return img.decode().catch(() => {});
          }),
      );
    });
    await page.screenshot({ path: `artifacts/front-office-start-${width}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    for (const [label, mode, target] of [
      ['Start the 2026 season', 'full', 'week-1'],
      ['Start Free Agency', 'free_agency', 'free_agency'],
      ['Start the Draft', 'draft', 'draft'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('p[role=alert]')).toContainText('Could not start your experience');
      expect(choices.at(-1)).toMatchObject({ selectedPath: mode, simulationPhase: target });
      expect(starts.at(-1)).toMatchObject({ action: 'initialize', target });
    }
    if (width > 1100) {
      await page.evaluate(() =>
        localStorage.setItem('dnd-front-office-path:start-screen-fixture', 'full'),
      );
      await page.reload();
      await expect(
        page
          .getByRole('navigation', { name: 'Front Office', exact: true })
          .getByRole('link', { name: 'Roster', exact: true }),
      ).toBeVisible();
    }
  });
}

test('start screen uses the same responsive structure for all 32 teams', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route('**/api/**', (route) =>
    new URL(route.request().url()).hostname === 'localhost'
      ? route.fulfill({ json: { ok: true, state: null, events: [] } })
      : route.continue(),
  );
  await page.goto('/');
  for (const team of TEAM_LIST) {
    await page.evaluate(({ id, abbr }) => {
      localStorage.removeItem('nfl-manager-experience');
      localStorage.setItem(
        'nfl-manager-save',
        JSON.stringify({
          version: 0,
          state: {
            saveId: 'palette-' + abbr,
            teamId: id,
            teamAbbr: abbr,
            franchiseYear: 2026,
            phase: 'resign_cut',
            roster: [],
            capSpace: 40,
            capLimit: 300,
            unlocked: { draft: false, freeAgency: false },
          },
        }),
      );
    }, team);
    await page.goto('/experience');
    await expect(page.locator('#franchise-start-title')).toHaveText(
      `Take control of the ${team.name.replace(team.city + ' ', '')}.`,
    );
    await expect(
      page.getByRole('button', { name: 'Start the 2026 season', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      team.abbr,
    ).toBe(true);
    await expect(
      page.locator('section[aria-labelledby="franchise-start-title"] img'),
    ).toHaveAttribute('src', team.logoUrl);
  }
});
