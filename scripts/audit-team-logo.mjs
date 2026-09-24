import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const output = process.env.LOGO_AUDIT_DIR ?? '/tmp/down-distance-logo-audit';
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/generate-team-logo.mjs', '--check']);
// Bundle the real shared component and Zustand selector, without an application API dependency.
const result = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: 'tsx',
    contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {FiveWideLogo} from './src/components/branding/fivewide-logo';
    import {TeamBrandedLogo} from './src/components/branding/team-branded-logo';
    import {useTeamStore} from './src/features/team/team-store';
    import {TEAM_BRANDED_LOGO_URLS} from './src/lib/team-brand-themes';
    import {getTeamLogoColors} from './src/lib/branding/team-logo-colors';
    window.logoAudit = {urls: TEAM_BRANDED_LOGO_URLS, colors: getTeamLogoColors};
    function App() {
      const {teams, selectedTeamId, setSelectedTeamId} = useTeamStore();
      return <><select aria-label="Team" value={selectedTeamId} onChange={e=>setSelectedTeamId(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{t.abbr}</option>)}</select>
      <div id="header"><FiveWideLogo size={62} imageClassName="max-h-14 sm:max-h-[var(--site-logo-height)]" containerClassName="h-14 w-28 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:h-[var(--site-logo-height)] sm:w-[var(--site-logo-width)]" /></div>
      <div id="generic"><FiveWideLogo generic size={120} containerClassName="h-auto w-52 border-0 bg-transparent p-0" /></div>
      <div id="gallery">{teams.map(t=><section key={t.id}><label>{t.abbr} — PNG / SVG</label><div style={{display:'flex',alignItems:'center'}}><img style={{width:230}} src={window.referenceImages[t.abbr]}/><TeamBrandedLogo team={t.abbr} width={230} height={230*806/1594}/></div></section>)}</div></>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `,
  },
  bundle: true,
  write: false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
execFileSync(
  'node_modules/.bin/tailwindcss',
  ['-i', 'src/app/globals.css', '-o', path.join(output, 'styles.css')],
  { stdio: 'pipe' },
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1,
  });
  const refs = Object.fromEntries(
    [
      ...readFileSync('src/lib/team-brand-themes.ts', 'utf8').matchAll(
        /(\w+): '(\/images\/team_branded_logos\/[^']+)'/g,
      ),
    ].map(([, abbr, url]) => [
      abbr,
      'data:image/png;base64,' + readFileSync('public' + url).toString('base64'),
    ]),
  );
  await page.setContent(
    '<html><head></head><body style="background:#888"><div id="root"></div></body></html>',
  );
  await page.addStyleTag({
    content:
      readFileSync(path.join(output, 'styles.css'), 'utf8') +
      '#gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:12px}#gallery label{font:14px sans-serif;color:#fff}#gallery svg{flex-shrink:0}',
  });
  await page.evaluate((refs) => (window.referenceImages = refs), refs);
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.locator('#gallery svg').last().waitFor();
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await page.locator('#gallery').screenshot({ path: path.join(output, 'all-teams.png') });
  // Verify unconstrained generic-logo sizing against the original badge as well.
  const genericSizing = await page.locator('#generic svg').evaluate(
    async (svg, src) => {
      const rect = svg.getBoundingClientRect();
      const img = new Image();
      img.src = src;
      img.width = Number(svg.getAttribute('width'));
      img.height = Number(svg.getAttribute('height'));
      img.className = svg.getAttribute('class');
      await img.decode();
      svg.replaceWith(img);
      const old = img.getBoundingClientRect();
      img.replaceWith(svg);
      return { vector: [rect.width, rect.height], raster: [old.width, old.height] };
    },
    'data:image/png;base64,' +
      readFileSync('public/images/down_distance_badge.png').toString('base64'),
  );
  assert.deepEqual(genericSizing.vector, genericSizing.raster, 'Generic logo dimensions changed');
  const checks = [];
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    let baseline;
    for (const abbr of Object.keys(refs)) {
      await page.getByRole('combobox', { name: 'Team' }).selectOption({ label: abbr });
      await page.waitForFunction(
        (abbr) =>
          document.querySelector('#header [data-logo-region="border"]').getAttribute('fill') ===
          window.logoAudit.colors(abbr).border,
        abbr,
      );
      const box = await page.locator('#header svg').boundingBox();
      const fills = await page
        .locator('#header svg')
        .evaluate((svg) =>
          [...svg.querySelectorAll('[data-logo-region]')].map((p) => [
            p.dataset.logoRegion,
            p.getAttribute('fill'),
          ]),
        );
      const colors = await page.evaluate((abbr) => window.logoAudit.colors(abbr), abbr);
      for (const [region, fill] of fills) assert.equal(fill, colors[region], abbr + ' ' + region);
      const size = [box.width, box.height];
      baseline ??= size;
      assert.deepEqual(size, baseline, `${abbr}: changed dimensions at ${width}px`);
      checks.push({ abbr, viewport: width, width: box.width, height: box.height });
    }
  }
  // Sample every reference region against the actual SVG output. PNGs contain texture;
  // report average RGB distance per semantic region rather than claim pixel identity.
  const comparisons = await page.evaluate(async () => {
    const read = async (src) => {
      const i = new Image();
      i.src = src;
      await i.decode();
      const c = document.createElement('canvas');
      c.width = 1594;
      c.height = 806;
      const x = c.getContext('2d');
      x.drawImage(i, 0, 0, 1594, 806);
      return x.getImageData(0, 0, 1594, 806).data;
    };
    const results = [];
    for (const section of document.querySelectorAll('#gallery section')) {
      const abbr = section.querySelector('label').textContent.split(' ')[0];
      const svg = section.querySelector('svg');
      const source = new XMLSerializer().serializeToString(svg);
      const raster = await read(section.querySelector('img').src);
      const vector = await read('data:image/svg+xml;base64,' + btoa(source));
      const colors = window.logoAudit.colors(abbr);
      const errors = {};
      for (const [region, hex] of Object.entries(colors)) {
        const rgb = hex
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16));
        let sum = 0,
          count = 0;
        for (let n = 0; n < vector.length; n += 4)
          if (
            vector[n + 3] === 255 &&
            rgb.every((v, k) => vector[n + k] === v) &&
            raster[n + 3] === 255
          ) {
            sum += rgb.reduce((s, v, k) => s + Math.abs(v - raster[n + k]), 0) / 3;
            count++;
          }
        errors[region] = { meanChannelError: Math.round((sum / count) * 100) / 100, pixels: count };
      }
      results.push({ abbr, errors });
    }
    return results;
  });
  for (const result of comparisons) {
    if (['ARI', 'ATL', 'BAL', 'CIN'].includes(result.abbr)) continue; // These four PNGs are incorrect artwork, not color/geometry targets.
    for (const [region, stats] of Object.entries(result.errors)) {
      // Denver's white border and orange badge/ticks supersede the old PNG.
      if (result.abbr === 'DEN' && ['border', 'badge', 'ticks'].includes(region)) continue;
      assert.ok(
        stats.pixels > 0 && stats.meanChannelError < 6,
        `${result.abbr} ${region} diverged from PNG`,
      );
    }
  }
  writeFileSync(
    path.join(output, 'results.json'),
    JSON.stringify({ checks, comparisons, genericSizing }, null, 2),
  );
  console.log(
    `Passed ${checks.length} team/viewport checks. Contact sheet and color comparisons: ${output}`,
  );
} finally {
  await browser.close();
}
