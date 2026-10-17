import { test, expect } from '@playwright/test';
test.skip(process.env.RUN_PARLAY_LOADING_LIVE !== '1', 'Opt-in local database integration check');
for (const route of ['/parlay-lab', '/parlay-lab/all-props']) {
  test('first visible props and completion: ' + route, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1536, height: 1000 });
    const apiTimes: string[] = [];
    page.on('response', async (response) => {
      if (!/\/api\/parlay-lab\/(props|research)\?/.test(response.url())) return;
      try {
        const body = await response.json();
        if (body.progress) apiTimes.push(JSON.stringify(body.progress));
      } catch {}
    });
    const start = Date.now();
    await page.goto(route + '?team=KC', { waitUntil: 'domcontentloaded' });
    test.skip(
      new URL(page.url()).pathname.includes('login') ||
        new URL(page.url()).pathname.includes('sign-in'),
      'An authenticated local browser session is required',
    );
    const row = page.locator('.lab-props tbody tr, .lab-nested-table tbody tr').first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const firstMs = Date.now() - start;
    await expect(page.getByRole('status').filter({ hasText: 'Loading more games' })).toHaveCount(
      0,
      { timeout: 60_000 },
    );
    await expect(row).toBeVisible();
    console.log(
      JSON.stringify({
        route,
        firstVisibleMs: firstMs,
        completedMs: Date.now() - start,
        progress: apiTimes,
      }),
    );
    await page.screenshot({
      path: '/tmp/parlay-loading-' + (route.endsWith('all-props') ? 'all' : 'home') + '.png',
    });
  });
}
