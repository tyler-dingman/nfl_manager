import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { tokenHash } from '../../src/server/auth/crypto';
import { test, expect } from '@playwright/test';
loadEnvConfig(process.cwd());
const actor = randomUUID(),
  token = randomUUID();
let db: ReturnType<typeof postgres>;
test.beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
  )
    throw Error('Localhost only');
  db = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
  await db`INSERT INTO users(id,status) VALUES(${actor},'ACTIVE')`;
  await db`INSERT INTO sessions(id,user_id,refresh_token_hash,token_family_id,expires_at) VALUES(${randomUUID()},${actor},${tokenHash(token)},${randomUUID()},now()+interval '1 hour')`;
});
test.afterAll(async () => {
  if (db) {
    await db`DELETE FROM users WHERE id=${actor}`;
    await db.end();
  }
});
for (const team of ['KC', 'SEA'])
  test(`${team} legacy recovery is explicit and preserves the old franchise`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'dd_session', value: token, url: 'http://localhost:3002' }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      ({ team, actor }) => {
        localStorage.setItem('dd-franchise-cache-owner', actor);
        localStorage.setItem(
          'nfl-manager-save',
          JSON.stringify({
            version: 0,
            state: {
              saveId: 'legacy-recovery-fixture',
              teamId: team.toLowerCase(),
              teamAbbr: team,
              franchiseYear: 2026,
              phase: 'week-3',
              roster: [],
              capSpace: 40,
              capLimit: 300,
              unlocked: { draft: true, freeAgency: true },
            },
          }),
        );
      },
      { team, actor },
    );
    const writes: string[] = [];
    await page.route('**/api/**', (route) => {
      const request = route.request();
      if (request.method() !== 'GET') writes.push(request.url());
      if (request.url().includes('/front-office/state'))
        return route.fulfill({
          status: 409,
          headers: { 'X-Franchise-Id': 'legacy-recovery-fixture', 'X-Franchise-Version': '7' },
          json: { ok: false, code: 'FRANCHISE_RECOVERY_REQUIRED' },
        });
      if (request.url().includes('/saves/create'))
        return route.fulfill({
          status: 503,
          json: { ok: false, error: 'Fixture: database unavailable' },
        });
      return route.fulfill({
        json: {
          ok: true,
          user: {
            id: actor,
            displayName: 'Recovery fixture',
            status: 'ACTIVE',
            emailVerified: false,
            createdAt: '2026-10-16T00:00:00Z',
          },
          state: null,
          events: [],
        },
      });
    });
    await page.goto('/experience');
    await expect(page.getByRole('heading', { name: 'Franchise recovery required' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View recovery report' })).toHaveAttribute(
      'href',
      /legacy-recovery-fixture/,
    );
    expect(writes).toHaveLength(0);
    await page.getByRole('button', { name: 'Start a separate franchise' }).click();
    await expect(page.locator('p[role=alert]')).toContainText('database unavailable');
    expect(writes).toHaveLength(1);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('nfl-manager-save')!).state.saveId),
    ).toBe('legacy-recovery-fixture');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/front-office-recovery-${team}.png`, fullPage: true });
  });
