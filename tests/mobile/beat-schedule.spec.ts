import { test, expect } from '@playwright/test';
for (const team of ['BUF', 'CIN']) {
  test(`canonical kickoff renders for ${team} on mobile and desktop`, async ({ page, request }) => {
    const response = await request.get(
      `/api/content/huddle?team=${team}&q=${team === 'BUF' ? 'Top Storylines' : 'How To Watch'}`,
    );
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const story = payload.briefings.find(
      (s: any) => s.game?.week === 3 && s.graphicDecision.graphic.family === 'game-matchup',
    );
    expect(story).toBeTruthy();
    expect(story.game.kickoffDisplay).toBe('SUN · 1:00 PM ET');
    expect(story.gameResolution.confidence).toBe('high');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/the-beat?team=${team}`);
      const card = page.locator(`[data-story-id="${story.id}"]`);
      await expect(card).toBeVisible();
      await expect(card.getByText('WEEK 3', { exact: true })).toBeVisible();
      await expect(card.getByText('SUN · 1:00 PM ET', { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const fits = await card
        .locator('[data-beat-composition="matchup"]')
        .evaluate((el) =>
          [...el.querySelectorAll('strong,span')].every(
            (child) => child.scrollWidth <= child.clientWidth + 2,
          ),
        );
      expect(fits).toBe(true);
      await card.screenshot({ path: `artifacts/beat-schedule-audit/${team}-${width}.png` });
    }
  });
}
test('same game has consistent schedule metadata across articles and stored final scores', async ({
  request,
}) => {
  const response = await request.get('/api/content/huddle?team=DEN&q=Chiefs');
  expect(response.ok()).toBeTruthy();
  const { briefings } = await response.json();
  const linked = briefings.filter((s: any) => s.game?.season === 2026 && s.game.week === 1);
  expect(linked.length).toBeGreaterThan(1);
  expect(
    new Set(
      linked.map((s: any) =>
        JSON.stringify([
          s.game.gameId,
          s.game.homeTeam,
          s.game.awayTeam,
          s.game.kickoffAt,
          s.game.weekDisplay,
        ]),
      ),
    ).size,
  ).toBe(1);
  expect(linked[0].game.kickoffDisplay).toBe('MON · 8:15 PM ET');
  for (const s of linked.filter((s: any) => s.graphicDecision.graphic.family === 'game-result')) {
    expect(s.graphicDecision.graphic.leftScore).toBe(s.game.awayScore);
    expect(s.graphicDecision.graphic.rightScore).toBe(s.game.homeScore);
  }
});
