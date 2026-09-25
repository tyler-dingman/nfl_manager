import { expect, test } from '@playwright/test';
import { getTeamHeroCopy, getTeamHeroDescription } from '../../src/config/team-hero-copy';
import { gameDayHeroAsset } from '../../src/config/game-day-hero';
import { getTeamDisplayAccent } from '../../src/lib/team-theme-tokens';

for (const width of [390, 768, 1440]) {
  test(`homepage fan headlines preserve image and layout at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/**', (route) =>
      new URL(route.request().url()).hostname === 'localhost'
        ? route.fulfill({
            json: { game: null, huddle: [], wire: [], videos: [], items: [], user: null },
          })
        : route.continue(),
    );
    await page.goto('/');
    for (const team of [
      'CAR',
      'KC',
      'PHI',
      'DET',
      'BUF',
      'MIA',
      'CIN',
      'GB',
      'DAL',
      'MIN',
      'SF',
      'SEA',
      'NYJ',
    ]) {
      await page.evaluate((team) => localStorage.setItem('down-distance-fan-team', team), team);
      await page.reload();
      const heading = page.locator('[data-home-team-headline]');
      const copy = getTeamHeroCopy(team);
      await expect(heading.locator('span')).toHaveText([copy.line1, copy.line2]);
      await page.evaluate(() => document.fonts.ready);
      const hero = heading.locator('xpath=ancestor::section[1]');
      await expect(hero.getByRole('link')).toHaveCount(0);
      const image = hero.locator('img');
      expect(decodeURIComponent((await image.getAttribute('src')) ?? '')).toContain(
        gameDayHeroAsset(team),
      );
      await expect(image).toHaveClass(/object-cover object-\[58%_center\] sm:object-center/);
      const metrics = await heading.evaluate((el) => {
        const s = getComputedStyle(el),
          r = el.getBoundingClientRect();
        const lines = [...el.children].map((child) => {
          const box = child.getBoundingClientRect();
          return {
            color: getComputedStyle(child).color,
            width: box.width,
            height: box.height,
            scroll: child.scrollWidth,
          };
        });
        return {
          font: s.fontFamily,
          style: s.fontStyle,
          weight: s.fontWeight,
          transform: s.textTransform,
          width: r.width,
          lines,
        };
      });
      expect(metrics.font).toContain('Barlow_Condensed');
      expect(metrics.style).toBe('italic');
      expect(metrics.weight).toBe('800');
      expect(metrics.transform).toBe('uppercase');
      expect(metrics.lines[0].color).toBe('rgb(255, 255, 255)');
      const hex = getTeamDisplayAccent(team);
      const rgb = `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
      expect(metrics.lines[1].color).toBe(rgb);
      for (const line of metrics.lines)
        expect(line.scroll, team).toBeLessThanOrEqual(metrics.width + 2);
      await expect(hero).toContainText(getTeamHeroDescription(team));
      if (width !== 768)
        await hero.screenshot({ path: `artifacts/home-team-hero/${team}-${width}.png` });
    }
  });
}
