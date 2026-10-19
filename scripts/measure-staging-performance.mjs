import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = new URL(process.argv[2] ?? 'http://localhost:8787');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  throw Error('This harness is local-only. Hosted staging measurements require a separately reviewed Access-authenticated runner.');
const routes = ['/', '/the-beat', '/watch', '/three-and-out', '/huddle', '/front-office', '/parlay-lab', '/account'];
const browser = await chromium.launch({ headless: true });
const samples = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile });
    await context.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
    await context.addInitScript(() => {
      window.__stagingPerf = { lcp: null, cls: 0 };
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__stagingPerf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__stagingPerf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: mobile ? 150 : 40, downloadThroughput: (mobile ? 1.6 : 10) * 1e6 / 8, uploadThroughput: 750000 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
    for (const path of routes) {
      await cdp.send('Network.clearBrowserCache');
      try {
        const response = await page.goto(new URL(path, base).href, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(1500);
        samples.push({ path, mobile, status: response?.status(), finalURL: page.url(), ...await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          return { ...window.__stagingPerf, ttfb: n.responseStart - n.requestStart,
            jsTransferBytes: resources.filter(e => e.initiatorType === 'script').reduce((n, e) => n + e.transferSize, 0),
            requests: resources.length, inp: null };
        }) });
      } catch (e) { samples.push({ path, mobile, error: e.message }); }
    }
    await context.close();
  }
} finally { await browser.close(); }
await mkdir('reports/staging-deployment', { recursive: true });
await writeFile('reports/staging-deployment/performance.json', JSON.stringify({ localOnly: true, simulatedMobile: true, nativeDevice: false, inp: 'Not measured: requires representative trusted interactions', samples }, null, 2));
if (samples.some(s => s.error || s.status >= 500)) process.exitCode = 1;
