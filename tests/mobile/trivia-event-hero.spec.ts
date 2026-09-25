import { expect, test } from '@playwright/test';
test('scheduled trivia countdown, sign-up, live entry and responsive theme', async ({ page }) => {
  let registrations = 0,
    registered = false,
    team = 'KC';
  const start = Date.now() + 65000;
  await page.clock.install({ time: new Date(start - 65000) });
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'localhost') return route.continue();
    const event = {
      id: '11111111-1111-4111-8111-111111111111',
      teamId: team,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + 240000).toISOString(),
      timezone: 'America/Chicago',
      status: 'SCHEDULED',
      registrationCount: registered ? 1 : 0,
      registered,
    };
    let data: any = { user: null, rows: [], stats: null };
    if (u.pathname === '/api/auth/me')
      data = { user: { id: 'test', displayName: 'Fan', primaryEmail: 'fan@example.com' } };
    if (u.pathname === '/api/trivia/events') data = { event };
    if (u.pathname.endsWith(event.id) && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body.action === 'register') {
        registrations++;
        registered = true;
        data = { ok: true };
      } else data = { ok: true, gameId: 'existing-drill' };
    }
    if (u.pathname === '/api/trivia/games/existing-drill')
      data = {
        gameId: 'existing-drill',
        completed: true,
        question: null,
        standings: [],
        score: 0,
        correctAnswers: 0,
        questionCount: 10,
      };
    return route.fulfill({ json: data });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/trivia?team=KC');
  const hero = page.locator('[data-editorial-hero="trivia"]');
  await expect(hero.getByRole('button', { name: 'SIGN UP' })).toBeVisible();
  await expect(hero).toContainText('01');
  await page.clock.fastForward(1000);
  await expect(hero).toContainText('04');
  await hero.getByRole('button', { name: 'SIGN UP' }).click();
  await expect(hero.getByRole('button', { name: "YOU'RE IN" })).toBeDisabled();
  expect(registrations).toBe(1);
  await expect(hero).toContainText('1 FAN ALREADY SIGNED UP');
  await page.evaluate(() => document.fonts.ready);
  await hero.screenshot({ path: 'artifacts/trivia-event-KC-desktop.png' });
  team = 'LAC';
  await page.goto('/trivia?team=LAC');
  await expect(hero.getByRole('button', { name: "YOU'RE IN" })).toBeVisible();
  await expect(hero.locator('h1 span')).toHaveCSS('color', 'rgb(0, 128, 198)');
  await page.setViewportSize({ width: 390, height: 1000 });
  await hero.screenshot({ path: 'artifacts/trivia-event-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.clock.fastForward(65000);
  await expect(hero.getByRole('button', { name: 'JOIN LIVE' })).toBeEnabled();
  await hero.getByRole('button', { name: 'JOIN LIVE' }).click();
  await expect(hero).toHaveCount(0);
});
