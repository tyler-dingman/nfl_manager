import { test, expect } from '@playwright/test';
for (const [team, query, name, action] of [
  ['WAS', 'Van Jefferson', 'Van Jefferson', 'SIGNED'],
  ['CLE', 'Krys Barnes', 'Krys Barnes', 'SIGNED'],
  ['CLE', 'Jimmy Horn', 'Jimmy Horn Jr.', 'SIGNED'],
  ['CLE', 'Nathaniel Watson', 'Nathaniel Watson', 'ELEVATED'],
  ['BUF', 'Greg Dortch', 'Greg Dortch', 'ELEVATED'],
  ['ATL', 'injured reserve', 'A.J. Terrell Jr.', 'PLACED_ON_IR'],
  ['BAL', 'Sign Wide Receiver', 'Shedrick Jackson', 'SIGNED'],
  ['DET', 'Jalen Mills', 'Jalen Mills', 'SIGNED'],
  ['PHI', 'Gabe Hall', 'Gabe Hall', 'RELEASED'],
])
  test(`${team} ${name} uses complete roster move composition`, async ({ page, request }) => {
    const response = await request.get(
      '/api/content/huddle?team=' + team + '&q=' + encodeURIComponent(query),
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const story = body.briefings.find(
      (s: any) =>
        s.graphicDecision.graphic.family === 'transaction' &&
        s.graphicDecision.graphic.name === name &&
        s.graphicDecision.graphic.action === action,
    );
    expect(story).toBeTruthy();
    expect(story.graphicDecision.displayCategory).toBe('Roster Move');
    await page.route('**/api/content/huddle?*', (r) =>
      r.fulfill({ json: { ...body, briefings: [story] } }),
    );
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/the-beat?team=' + team);
      const graphic = page.locator('[data-beat-family="transaction"]');
      await expect(graphic).toBeVisible();
      await expect(
        graphic.locator('[data-beat-layer="directional-four-chevrons"] path'),
      ).toHaveCount(4);
      await expect(graphic.getByRole('img')).toBeVisible();
      await expect
        .poll(
          () =>
            graphic
              .getByRole('img')
              .evaluate(
                (el) =>
                  (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
              ),
          { timeout: 20000 },
        )
        .toBe(true);
      await expect(graphic.getByText(name, { exact: true })).toBeVisible();
      await expect(graphic.getByText('Roster Move', { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const fits = await graphic.evaluate((el) =>
        [...el.querySelectorAll('strong,small,span')].every((child) => {
          const a = child.getBoundingClientRect(),
            b = el.getBoundingClientRect();
          return (
            a.bottom <= b.bottom + 1 &&
            a.right <= b.right + 1 &&
            child.scrollWidth <= child.clientWidth + 2
          );
        }),
      );
      expect(fits).toBe(true);
      await graphic.screenshot({
        path: `artifacts/beat-transaction-audit/${team}-${name.replaceAll(' ', '-')}-${width}.png`,
        scale: 'css',
      });
    }
  });

test('all backfilled transaction compositions fit without clipping', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const audit = JSON.parse(await readFile('artifacts/beat-transaction-audit/stories.json', 'utf8'));
  const briefings = audit
    .filter((s: any) => s.decision.graphic.family === 'transaction')
    .map((s: any) => ({
      id: s.id,
      teamAbbr: s.team,
      headline: s.headline,
      summary: s.summary,
      category: s.category,
      updatedAt: s.decision.asOf,
      sources: [],
      graphicDecision: s.decision,
    }));
  await page.route('**/api/content/huddle?*', (r) =>
    r.fulfill({
      json: {
        briefings,
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: briefings.length,
          pageSize: briefings.length,
        },
      },
    }),
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/the-beat?team=WAS');
    await expect(page.locator('[data-beat-family="transaction"]')).toHaveCount(briefings.length);
    await page.evaluate(() => document.fonts.ready);
    const invalid = await page.locator('[data-beat-family="transaction"]').evaluateAll((cards) =>
      cards.flatMap((card) => {
        const b = card.getBoundingClientRect();
        const bad = [...card.querySelectorAll('strong,small')].filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.bottom > b.bottom + 1 || r.right > b.right + 1 || el.scrollWidth > el.clientWidth + 2
          );
        });
        if (
          card.querySelectorAll('[data-beat-layer="directional-four-chevrons"] path').length !== 4
        )
          return ['chevrons'];
        return bad.map((el) => el.textContent);
      }),
    );
    expect(invalid).toEqual([]);
  }
});
