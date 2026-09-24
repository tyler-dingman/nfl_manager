import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
fs.mkdirSync('/tmp/down-distance-logo-audit', { recursive: true });
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 393, height: 852 } });
    const refs = [
      ...fs
        .readFileSync('src/lib/team-brand-themes.ts', 'utf8')
        .matchAll(/(\w+): '(\/images\/team_branded_logos\/[^']+)'/g),
    ];
    const names = Object.keys(
      JSON.parse(
        fs.readFileSync('public/images/team_branded_logos/down-distance-team-colors.json'),
      ),
    );
    const overrides = JSON.parse(fs.readFileSync('src/lib/branding/team-logo-overrides.json'));
    const checks = [];
    for (const [index, [, abbr, url]] of refs.entries()) {
      await p.goto(baseURL + '/?team-select=1', { waitUntil: 'domcontentloaded' });
      await p.getByRole('button', { name: names[index], exact: true }).click();
      const logo = p.locator('[data-site-header] svg[aria-label="Down & Distance"]');
      await logo.waitFor();
      await p.waitForFunction(
        (color) =>
          document
            .querySelector('[data-site-header] [data-logo-region="background"]')
            ?.getAttribute('fill') === color,
        overrides[abbr]?.background ?? '#000000',
      );
      const boxes = await logo.evaluate(async (svg, url) => {
        const before = svg.getBoundingClientRect();
        const im = new Image();
        im.src = url;
        im.width = Number(svg.getAttribute('width'));
        im.height = Number(svg.getAttribute('height'));
        im.className = svg.getAttribute('class');
        await im.decode();
        svg.replaceWith(im);
        const old = im.getBoundingClientRect();
        im.replaceWith(svg);
        return {
          vector: { width: before.width, height: before.height },
          raster: { width: old.width, height: old.height },
          png: [im.naturalWidth, im.naturalHeight],
        };
      }, url);
      assert.deepEqual(boxes.vector, boxes.raster, abbr);
      checks.push({ abbr, ...boxes });
    }
    await p.screenshot({ path: '/tmp/down-distance-logo-audit/site-mobile.png' });
    await p.getByRole('button', { name: 'Open menu', exact: true }).click();
    await p.getByRole('dialog', { name: 'Site menu' }).waitFor();
    await p.screenshot({ path: '/tmp/down-distance-logo-audit/site-mobile-menu.png' });
    await p.keyboard.press('Escape');
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.screenshot({ path: '/tmp/down-distance-logo-audit/site-desktop.png' });
    fs.writeFileSync(
      '/tmp/down-distance-logo-audit/site-results.json',
      JSON.stringify(checks, null, 2),
    );
    console.log(
      'All 32 teams selected in actual site; raster and SVG element dimensions match. Desktop and mobile menu screenshots saved.',
    );
  } finally {
    await b.close();
  }
})();
