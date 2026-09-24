// Usage: FO_AUDIT_STORAGE=/absolute/path/to/playwright-storage.json node scripts/audit-front-office-redesign.cjs
// The storage file must contain an authenticated local QA franchise. Do not commit it.
if (!process.env.FO_AUDIT_STORAGE)
  throw new Error('Set FO_AUDIT_STORAGE to a local QA browser storage file.');
const { chromium } = require(process.cwd() + '/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: process.env.FO_AUDIT_STORAGE,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const routes = [
    '/experience',
    '/roster?view=roster',
    '/free-agents',
    '/front-office/draft',
    '/league',
    '/front-office/trade-hub?context=roster',
  ];
  fs.mkdirSync('artifacts/front-office-redesign', { recursive: true });
  const results = [];
  for (let i = 0; i < routes.length; i++) {
    await page.goto('http://localhost:3000' + routes[i], { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    if (i === 0) await page.locator('.fo-home-panel').first().waitFor({ timeout: 30000 });
    if (i === 1 || i === 2) {
      await page.locator('.fo-player-table').waitFor({ timeout: 30000 });
      await page.waitForFunction(
        () => {
          const el = document.querySelector('.fo-player-table');
          return (
            el && !el.querySelector('.animate-pulse') && !el.textContent.includes('Loading players')
          );
        },
        {},
        { timeout: 30000 },
      );
    }
    if (i === 3)
      await page
        .getByRole('heading', { name: 'Top Draft News', exact: true })
        .waitFor({ timeout: 30000 });
    if (i === 4)
      await page
        .getByRole('heading', { name: 'Latest News', exact: true })
        .waitFor({ timeout: 30000 });
    if (i === 5)
      await page
        .getByRole('button', { name: /Breece Hall/ })
        .first()
        .waitFor({ timeout: 30000 });
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.isVisible()) await skip.click();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(() => ({
        url: location.pathname,
        title: document.querySelector('main h1')?.textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
        wide: [...document.querySelectorAll('main *')]
          .filter(
            (e) =>
              e.getBoundingClientRect().right > innerWidth + 2 &&
              getComputedStyle(e).position !== 'fixed' &&
              !e.closest('.overflow-x-auto'),
          )
          .slice(0, 10)
          .map((e) => ({ tag: e.tagName, cls: e.className, w: e.getBoundingClientRect().width })),
        bg: getComputedStyle(document.querySelector('.front-office-app')).backgroundColor,
      }));
      results.push({ route: routes[i], width, ...metrics });
      await page.screenshot({ path: `artifacts/front-office-redesign/page-${i}-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log('DONE', routes[i]);
  }
  fs.writeFileSync(
    'artifacts/front-office-redesign/audit.json',
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
})();
