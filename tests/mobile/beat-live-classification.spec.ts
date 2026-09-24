import { enrichBeatTransaction } from '../../src/server/content/beat-transactions';
import { expect, test } from '@playwright/test';
import review from '../../src/components/beat/__fixtures__/review-stories.json';
import stories from '../../src/components/beat/__fixtures__/live-stories.json';
import { adaptBeatStory } from '../../src/components/beat/beat-story-adapter';

for (const width of [390, 1440]) {
  test('real feed payloads use production adapter at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const team of ['HOU', 'MIA', 'BUF', 'CHI', 'TB', 'IND']) {
      const selected = stories.filter((s) => s.teamAbbr === team);
      await page.route('**/api/content/huddle?*', (route) =>
        route.fulfill({
          json: {
            briefings: selected,
            pagination: { page: 1, pageSize: 20, totalItems: 8, totalPages: 1 },
          },
        }),
      );
      await page.goto('/the-beat?team=' + team);
      await expect(page.locator('[data-beat-card]')).toHaveCount(8);
      await page.evaluate(() => document.fonts.ready);
      for (const story of selected) {
        const card = page.locator('[data-story-id="' + story.id + '"]');
        await expect(card.locator('[data-beat-family]')).toHaveAttribute(
          'data-beat-family',
          adaptBeatStory(story).graphic.family,
        );
      }
      const overflow = await page
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
      expect(overflow).toEqual([]);
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((img) => {
            img.loading = 'eager';
            return img.decode().catch(() => {});
          }),
        );
      });
      await page.screenshot({
        path: 'artifacts/beat-audit/' + team + '-' + width + '.png',
        fullPage: true,
      });
      await page.unroute('**/api/content/huddle?*');
    }
  });
}

test('live API exposes decisions and retains filter/pagination contracts', async ({ request }) => {
  for (const team of ['HOU', 'MIA', 'BUF', 'CHI', 'TB', 'IND']) {
    const response = await request.get('/api/content/huddle?team=' + team);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    for (const story of body.briefings.slice(0, 8)) {
      expect(story.graphicDecision).toEqual(enrichBeatTransaction(story));
    }
    const filtered = await (
      await request.get('/api/content/huddle?team=' + team + '&type=GAMES')
    ).json();
    expect(
      filtered.briefings.every((s: { category: string }) => s.category === 'GAME'),
    ).toBeTruthy();
    if (body.pagination.totalPages > 1) {
      const next = await (await request.get('/api/content/huddle?team=' + team + '&page=2')).json();
      expect(next.pagination.page).toBe(2);
      expect(next.briefings[0].id).not.toBe(body.briefings[0].id);
    }
  }
});

test('production filter buttons and pagination navigate the live feed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/the-beat?team=BUF');
  await expect(page.locator('[data-beat-card]').first()).toBeVisible();
  const firstId = await page.locator('[data-beat-card]').first().getAttribute('data-story-id');
  await page
    .getByRole('button', { name: 'Next page', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('[data-beat-card]').first()).not.toHaveAttribute(
    'data-story-id',
    firstId!,
  );
  await page.getByRole('button', { name: 'Games', exact: true }).click();
  await expect(page).toHaveURL(/type=GAMES/);
  await expect(page.getByRole('button', { name: 'Games', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-beat-card]').first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).not.toBe('2');
});

test('review excerpt regression cards render through the production adapter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const briefings = review.map((story) => ({
    ...story,
    graphicDecision: adaptBeatStory(story),
    updatedAt: '2026-09-24T12:00:00Z',
    sourceCount: 0,
    sources: [],
  }));
  await page.route('**/api/content/huddle?*', (route) =>
    route.fulfill({
      json: { briefings, pagination: { page: 1, totalPages: 1, totalItems: 48, pageSize: 48 } },
    }),
  );
  await page.goto('/the-beat?team=MIA');
  await expect(page.locator('[data-beat-card]')).toHaveCount(48);
  await page.evaluate(() => document.fonts.ready);
  for (const story of review) {
    const card = page.locator('[data-story-id="' + story.id + '"]');
    await expect(card.locator('[data-beat-family]')).toHaveAttribute(
      'data-beat-family',
      new RegExp('^' + story.expected),
    );
    if (story.expected === 'transaction')
      await expect(card.locator('[data-beat-layer="directional-four-chevrons"] path')).toHaveCount(
        4,
      );
  }
  await expect(page.locator('[data-story-id="review-10"]')).toContainText('Liam Anderson');
  await expect(page.locator('[data-story-id="review-1"] [data-beat-family]')).toContainText('W3');
  const overflow = await page
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
  expect(overflow).toEqual([]);
});
