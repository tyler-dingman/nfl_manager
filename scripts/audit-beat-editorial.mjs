import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const accents = JSON.parse(await readFile('public/assets/the-beat-asset-library/config/team-accents.json', 'utf8'));
const output = 'artifacts/beat-editorial-audit';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  await page.goto('http://localhost:3000/dev/beat-cards');
  await page.addStyleTag({ content: 'html { zoom: 1 !important; }' });
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator('[data-fixture="feature"]');
  const top = card.locator('[data-beat-composition="editorial"]');
  const captures = ['IND','DEN','JAX','KC','BUF','CIN','PHI'];
  for (const width of [280,400]) {
    await page.setViewportSize({ width: width === 280 ? 390 : 1440, height: 1000 });
    await page.getByLabel('Card width').selectOption(String(width));
    let geometry;
    for (const team of Object.keys(accents.teams)) {
      await page.getByLabel('Team', { exact:true }).selectOption(team);
      assert.equal(await top.locator('[data-editorial-part="word"]').textContent(), 'EDITORIAL');
      assert.equal(await top.locator('[data-editorial-part="team"]').textContent(), team);
      assert.equal(await top.locator('img').count(), 0);
      const metrics = await top.evaluate(el => {
        const canvas = el.firstElementChild;
        const base = canvas.getBoundingClientRect();
        const measure = selector => {
          const node=el.querySelector(selector), r=node.getBoundingClientRect(), s=getComputedStyle(node);
          return { x:r.x-base.x,y:r.y-base.y,width:r.width,height:r.height,fontSize:s.fontSize,fontWeight:s.fontWeight,opacity:s.opacity,font:s.fontFamily };
        };
        return { width:base.width,height:base.height,accent:el.style.getPropertyValue('--beat-accent'),word:measure('[data-editorial-part="word"]'),team:measure('[data-editorial-part="team"]'),rule:measure('[data-editorial-part="rule"]') };
      });
      assert.equal(metrics.accent, accents.teams[team].accent);
      assert(metrics.word.font.includes('Barlow_Condensed'));
      assert.equal(metrics.word.opacity,'0.085');
      assert(metrics.word.y > metrics.height * .18);
      assert(metrics.word.y + metrics.word.height < metrics.team.y);
      const {accent,...shape}=metrics;
      geometry ??= shape;
      assert.deepEqual(shape,geometry);
      results.push({team,width,...metrics});
      if(captures.includes(team)) await top.screenshot({path:`${output}/${team}-${width}.png`});
    }
  }
  await writeFile(`${output}/geometry.json`,JSON.stringify(results,null,2));
  // One sheet per size makes cross-team visual comparison straightforward.
  for(const width of [280,400]) {
    const images=await Promise.all(captures.map(async team=>({team,data:(await readFile(`${output}/${team}-${width}.png`)).toString('base64')})));
    await page.setViewportSize({width:1200,height:900});
    await page.setContent(`<body style="margin:20px;background:#e5e7eb;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(4,280px);gap:12px">${images.map(({team,data})=>`<div>${team}<img style="display:block;width:280px" src="data:image/png;base64,${data}"></div>`).join('')}</div></body>`);
    await page.screenshot({path:`${output}/teams-${width}.png`});
  }
  console.log('Verified identical Editorial geometry and configured accents for all 32 teams at 280/400px; captured seven requested teams.');
} finally { await browser.close(); }
