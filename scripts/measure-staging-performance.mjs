import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = new URL(process.argv[2] ?? 'http://localhost:8787');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  throw Error(
    'This harness is local-only. Hosted staging measurements require a separately reviewed Access-authenticated runner.',
  );
const statePath = process.argv[3];
const outPath = process.argv[4] ?? 'reports/staging-deployment/performance.json';
const routes = [
  '/',
  '/the-beat',
  '/watch',
  '/three-and-out',
  '/huddle',
  '/front-office',
  '/parlay-lab',
  '/account',
];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const samples = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile,
      ...(statePath ? { storageState: statePath } : {}),
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    );
    await context.addInitScript(() => {
      localStorage.setItem('down-distance-fan-team', 'KC');
      window.__stagingPerf = { lcp: null, cls: 0, lcpElement: null, shifts: [] };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__stagingPerf.lcp = e.startTime;
          window.__stagingPerf.lcpElement = e.element
            ? {
                tag: e.element.tagName,
                id: e.element.id,
                className: String(e.element.className).slice(0, 180),
              }
            : null;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) {
            window.__stagingPerf.cls += e.value;
            window.__stagingPerf.shifts.push({
              value: e.value,
              sources: (e.sources ?? []).map((s) => ({
                tag: s.node?.nodeName,
                before: s.previousRect,
                after: s.currentRect,
              })),
            });
          }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: mobile ? 150 : 40,
      downloadThroughput: ((mobile ? 1.6 : 10) * 1e6) / 8,
      uploadThroughput: 750000 / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
    for (const path of routes) {
      await cdp.send('Network.clearBrowserCache');
      try {
        const response = await page.goto(new URL(path, base).href, {
          waitUntil: 'load',
          timeout: 60000,
        });
        await page.waitForTimeout(1500);
        samples.push({
          path,
          mobile,
          status: response?.status(),
          finalURL: page.url(),
          ...(await page.evaluate(() => {
            const n = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            return {
              ...window.__stagingPerf,
              ttfb: n.responseStart - n.requestStart,
              jsTransferBytes: resources
                .filter((e) => e.initiatorType === 'script')
                .reduce((n, e) => n + e.transferSize, 0),
              requests: resources.length,
              inp: null,
            };
          })),
        });
      } catch (e) {
        samples.push({ path, mobile, error: e.message });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await mkdir(new URL('.', new URL(outPath, 'file://' + process.cwd() + '/')).pathname, {
  recursive: true,
});
await writeFile(
  outPath,
  JSON.stringify(
    {
      localOnly: true,
      simulatedMobile: true,
      nativeDevice: false,
      inp: 'Not measured: requires representative trusted interactions',
      samples,
    },
    null,
    2,
  ),
);
if (samples.some((s) => s.error || s.status >= 500)) process.exitCode = 1;
