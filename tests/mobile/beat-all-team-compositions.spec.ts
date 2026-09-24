import { test, expect } from '@playwright/test';
import stories from '../../src/components/beat/__fixtures__/all-team-stories.json';
import { adaptBeatStory } from '../../src/components/beat/beat-story-adapter';
import { beatPalette, validBeatGraphic } from '../../src/components/beat/beat-model';

const teams = [...new Set(stories.map((s) => s.teamAbbr))];
const focus = new Set([
  'KC',
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'LV',
]);
for (const team of teams) {
  test('complete compositions for ' + team, async ({ page }) => {
    const raw = stories.filter((s) => s.teamAbbr === team);
    const briefings = raw.map((s) => ({ ...s, graphicDecision: adaptBeatStory(s) }));
    await page.route('**/api/content/huddle?*', (route) =>
      route.fulfill({
        json: { briefings, pagination: { page: 1, totalPages: 1, totalItems: 8, pageSize: 20 } },
      }),
    );
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/the-beat?team=' + team);
      await expect(page.locator('[data-beat-card]')).toHaveCount(8);
      await page.evaluate(() => document.fonts.ready);
      for (const story of briefings) {
        expect(validBeatGraphic(story.graphicDecision.graphic)).toBeTruthy();
        const card = page.locator('[data-story-id="' + story.id + '"]');
        await expect(card.locator('[data-beat-family]')).toHaveAttribute(
          'data-beat-family',
          story.graphicDecision.graphic.family,
        );
        expect(
          await card.evaluate((el) =>
            getComputedStyle(el).getPropertyValue('--beat-accent').trim(),
          ),
        ).toBe(beatPalette(team).accent);
      }
      const failures = await page.locator('[data-beat-card]').evaluateAll((cards) => {
        const bad: string[] = [];
        // Display numerals intentionally use .85 line-height; glyph ascent can exceed the
        // line box without clipping. Check the canvas bounds and horizontal fit instead.
        for (const card of cards) {
          const top = card.querySelector('[data-beat-family]')!;
          const bounds = top.getBoundingClientRect();
          if (!getComputedStyle(top.firstElementChild!).fontFamily.includes('Barlow_Condensed'))
            bad.push('font');
          for (const el of top.querySelectorAll(
            '[data-beat-composition] strong, [data-beat-composition] small, [data-beat-composition] span:not([aria-hidden]), [data-beat-slot]:not([aria-hidden])',
          )) {
            const rect = el.getBoundingClientRect();
            if (
              el.textContent?.trim() &&
              (rect.left < bounds.left - 1 ||
                rect.right > bounds.right + 1 ||
                rect.bottom > bounds.bottom + 1 ||
                rect.top < bounds.top + 30 ||
                el.scrollWidth > el.clientWidth + 2)
            )
              bad.push(card.getAttribute('data-story-id') + ': ' + el.textContent);
          }
          const numbered = top.querySelector('[data-beat-composition="numbered"]');
          if (numbered) {
            const [a, b] = [...numbered.children].map((e) => e.getBoundingClientRect());
            if (
              Math.abs(a.top + a.height / 2 - b.top - b.height / 2) > 2 ||
              b.left - a.right > 29 ||
              b.left - a.right < 10
            )
              bad.push('number alignment');
          }
          const injury = top.querySelector(
            '[data-beat-composition="injury"][data-has-week="true"]',
          );
          if (injury) {
            const [a, d, b] = [...injury.children].map((e) => e.getBoundingClientRect());
            if (Math.abs(d.left - a.right - (b.left - d.right)) > 2) bad.push('injury divider');
          }
        }
        const heights = cards.map(
          (c) => c.querySelector('[data-beat-family]')!.getBoundingClientRect().height,
        );
        if (Math.max(...heights) - Math.min(...heights) > 1) bad.push('inconsistent dark heights');
        return bad;
      });
      expect(failures).toEqual([]);
      if (focus.has(team)) {
        await page.locator('[data-beat-family] img').evaluateAll(async (imgs) =>
          Promise.all(
            imgs.map((el) => {
              const img = el as HTMLImageElement;
              img.loading = 'eager';
              return img.decode().catch(() => {});
            }),
          ),
        );
        await page.locator('#beat-feed-start').screenshot({
          path: 'artifacts/beat-renderer-audit/' + team + '-' + width + '.png',
          scale: 'css',
        });
      }
    }
  });
}
