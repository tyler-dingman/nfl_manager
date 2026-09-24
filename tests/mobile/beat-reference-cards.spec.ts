import { expect, test } from '@playwright/test';

for (const width of [280, 320, 400]) {
  test(`Beat composition gallery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dev/beat-cards');
    // Isolate exact reference canvas sizes from the site's intentional 90% desktop density.
    await page.addStyleTag({ content: 'html { zoom: 1 !important; }' });
    await page.getByLabel('Card width').selectOption(String(width));
    await expect(page.locator('[data-beat-card]').first().locator('time')).toContainText('Updated');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('[data-beat-family]').count()).toBe(27);
    await expect(
      page.locator(
        '[data-fixture="transaction"] [data-beat-layer="directional-four-chevrons"] path',
      ),
    ).toHaveCount(4);
    await expect(
      page.locator('[data-fixture="long-action"] [data-beat-layer="contract-divider"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-fixture="missing-data"] [data-beat-family]')).toHaveAttribute(
      'data-beat-family',
      /standard-/,
    );
    const metrics = await page.locator('[data-beat-family]').evaluateAll((elements) =>
      elements.map((element) => {
        const canvas = element.firstElementChild!;
        const rect = canvas.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          font: getComputedStyle(canvas).fontFamily,
        };
      }),
    );
    for (const metric of metrics) {
      expect(Math.abs(metric.width - (width - 2))).toBeLessThan(1);
      expect(Math.abs(metric.height / metric.width - 180 / 320)).toBeLessThan(0.01);
      expect(metric.font).toContain('Barlow_Condensed');
    }
    const overflowing = await page
      .locator('[data-beat-family] span')
      .evaluateAll((elements) =>
        elements
          .filter(
            (el) =>
              el.className.includes('slot') &&
              !el.getAttribute('aria-hidden') &&
              (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2),
          )
          .map((el) => el.textContent),
      );
    expect(overflowing).toEqual([]);
    await page.screenshot({ path: `artifacts/beat-gallery-${width}.png`, fullPage: true });
    const first = page.locator('[data-beat-card]').first();
    await first.getByRole('button', { name: /^Save / }).click();
    await expect(first.getByRole('button', { name: /^Remove / })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await first.getByRole('button', { name: /^Remove / }).focus();
    await page.keyboard.press('Enter');
    await expect(first.getByRole('button', { name: /^Save / })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      await first
        .getByRole('button', { name: /^Save / })
        .evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe('solid');
  });
}
for (const width of [375, 390, 1440]) {
  test(`live Beat route preserves card actions and selected-team branding at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const story = {
      id: 'beat-test-story',
      teamAbbr: 'KC',
      headline: 'Verified fixture story about the current roster',
      summary: 'A source-backed summary remains readable within the white editorial body.',
      category: 'INJURY',
      sourceCount: 1,
      updatedAt: '2026-09-24T12:00:00Z',
      materialUpdateCount: 2,
      hotReadUntil: '2099-01-01T00:00:00Z',
      firstReportedBy: 'Fixture Reporter',
      sources: [
        {
          id: 'source-one',
          publisher: 'Fixture Reporter',
          url: 'https://example.com/report',
          title: 'Original reporting',
          publishedAt: '2026-09-24T12:00:00Z',
        },
      ],
    };
    const saves: string[] = [];
    const shares: unknown[] = [];
    const opens: unknown[] = [];
    await page.route('**/api/**', (route) => route.fulfill({ json: {} }));
    await page.route('**/api/user/content-state', async (route) => {
      opens.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          user: {
            id: 'fixture-user',
            displayName: 'Fixture Reader',
            primaryEmail: 'reader@example.com',
            status: 'ACTIVE',
          },
        },
      }),
    );
    await page.route('**/api/content/huddle?*', (route) =>
      route.fulfill({
        json: {
          briefings: [story, { ...story, id: 'coaching', category: 'COACHING' }],
          pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
        },
      }),
    );
    await page.route('**/api/user/saved-content**', async (route) => {
      saves.push(route.request().method());
      await route.fulfill({ json: { items: [], ok: true } });
    });
    await page.route('**/api/crew/share', async (route) => {
      if (route.request().method() === 'POST') shares.push(route.request().postDataJSON());
      await route.fulfill({
        json: { ok: true, recipients: [{ id: 'friend', displayName: 'Fixture Friend' }] },
      });
    });
    await page.goto('/the-beat?team=BUF');
    const card = page.locator('[data-story-id="beat-test-story"]');
    await expect(card.locator('time')).toContainText('Updated');
    await page.evaluate(() => document.fonts.ready);
    await expect(card.locator('[data-beat-family]')).toHaveAttribute(
      'data-beat-family',
      /standard-/,
    );
    expect(
      await card.evaluate((el) => getComputedStyle(el).getPropertyValue('--beat-accent').trim()),
    ).toBe('#006DCE');
    await expect(card.getByText(/Hot Read/)).toContainText('First reported by Fixture Reporter');
    await card.getByRole('button', { name: /^Save / }).click();
    await expect(card.getByRole('button', { name: /^Remove / })).toBeVisible();
    expect(saves).toContain('POST');
    await card.getByRole('button', { name: /^Remove / }).click();
    await expect(card.getByRole('button', { name: /^Save / })).toBeVisible();
    expect(saves).toContain('DELETE');
    await expect(card).toContainText('2 updates');
    await card.getByLabel('View 1 source').click();
    await expect(
      card.getByRole('link', { name: /First reported by · Fixture Reporter/ }),
    ).toHaveAttribute('href', 'https://example.com/report');
    await card.getByLabel('View 1 source').click();
    await card.getByRole('button', { name: 'Share with the Crew' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Fixture Friend')).toBeVisible();
    await dialog.getByRole('button', { name: /Send beat story/ }).click();
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({
      contentId: story.id,
      contentType: 'BEAT_STORY',
      href: '/content/beat-test-story',
    });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/beat-live-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(card.getByRole('link', { name: `Open story: ${story.headline}` })).toHaveAttribute(
      'href',
      '/content/beat-test-story',
    );
    await page.route('**/content/beat-test-story', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Fixture detail destination</h1>' }),
    );
    await card.getByRole('link', { name: `Open story: ${story.headline}` }).click();
    await expect(page).toHaveURL(/\/content\/beat-test-story$/);
    expect(opens).toContainEqual({
      contentType: 'STORY',
      contentId: story.id,
      mediaVersion: story.updatedAt,
      viewed: true,
    });
  });
}
