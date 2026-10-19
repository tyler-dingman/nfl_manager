import { chromium, request } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import assert from 'node:assert/strict';
assert(
  process.env.PHASE_TWO_SYNTHETIC_DATABASE === 'true' &&
    new URL(process.env.DATABASE_URL).hostname === 'localhost',
);
const phase = process.env.PERFORMANCE_PHASE ?? 'before',
  out = `reports/performance/${phase}`;
const socket = createServer();
await new Promise((r) => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const base = `http://localhost:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  AUTH_BASE_URL: base,
  PRELAUNCH_MODE: 'false',
  NODE_OPTIONS: '--require ./scripts/phase-two-network-guard.cjs',
};
const log = createWriteStream(out + '/server.log'),
  child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
let browser;
const results = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/auth/config')).ok) break;
    } catch {}
    if (child.exitCode !== null) throw Error('Next server failed');
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ channel: 'chrome' });
  const account = await request.newContext({ baseURL: base });
  const signed = await account.post('/api/auth/signup', {
    headers: { origin: base },
    data: { email: `perf-${phase}@example.invalid`, password: 'synthetic-performance-password' },
  });
  assert.equal(signed.status(), 201, await signed.text());
  const storageState = await account.storageState();
  const routes = [
    ['Homepage', '/?team=kc'],
    ['The Beat', '/the-beat?team=kc'],
    ['Film Room', '/watch?team=kc'],
    ['Three & Out', '/three-and-out?team=kc'],
    ['The Huddle', '/huddle?team=kc'],
    ['AI Search', '/?team=kc&search=1'],
    ['Front Office', '/front-office?team=kc'],
    ['Parlay Lab', '/parlay-lab?team=kc'],
    ['Trending Props', '/parlay-lab?team=kc&tab=trending'],
    ['Bet Slip', '/parlay-lab/my-plays'],
    ['Profile', '/account/profile'],
  ];
  for (const device of ['mobile', 'desktop'])
    for (const [name, path] of routes) {
      const context = await browser.newContext({
        viewport: device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        storageState,
      });
      await context.addInitScript(() => localStorage.setItem('down-distance-fan-team', 'KC'));
      const page = await context.newPage(),
        cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: device === 'mobile' ? 100 : 40,
        downloadThroughput: ((device === 'mobile' ? 1.6 : 10) * 1024 * 1024) / 8,
        uploadThroughput: ((device === 'mobile' ? 0.75 : 5) * 1024 * 1024) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: device === 'mobile' ? 4 : 1 });
      const api = [],
        errors = [];
      page.on('response', async (r) => {
        if (r.url().includes('/api/')) {
          const q = r.request(),
            timing = q.timing();
          api.push({
            path: new URL(r.url()).pathname,
            status: r.status(),
            ttfbMs: timing.responseStart >= 0 ? timing.responseStart - timing.requestStart : null,
            cache: r.headers()['x-application-cache'] ?? null,
          });
        }
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(() => {
        window.__perf = { lcp: null, cls: 0, events: [] };
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          if (e) window.__perf.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            if (e.interactionId)
              window.__perf.events.push({ id: e.interactionId, duration: e.duration });
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      });
      const response = await page.goto(base + path, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(3000);
      // Benign real click supports Event Timing; no synthetic financial/game mutation.
      const button = page.getByRole('button', { name: /menu|select team|choose team/i }).first();
      if (await button.count()) await button.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0],
          resources = performance.getEntriesByType('resource');
        const durations = Object.values(
          Object.fromEntries(window.__perf.events.map((e) => [e.id, e.duration])),
        );
        return {
          lcpMs: window.__perf.lcp,
          cls: window.__perf.cls,
          interactionLatencyMs: durations.length ? Math.max(...durations) : null,
          interactionMetric: 'Event Timing local interaction sample; not field INP',
          ttfbMs: nav.responseStart - nav.requestStart,
          scriptEncodedBytes: resources
            .filter((r) => r.initiatorType === 'script')
            .reduce((n, r) => n + (r.encodedBodySize || 0), 0),
          scriptRequests: resources.filter((r) => r.initiatorType === 'script').length,
          resourceRequests: resources.length,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      results.push({
        name,
        path,
        device,
        status: response.status(),
        ...metrics,
        api,
        errors,
        fixture:
          'synthetic partial PostgreSQL schema; external provider network blocked; failed/empty content retained and reported',
      });
      console.log(
        `${phase} ${device} ${name} LCP=${metrics.lcpMs}ms JS=${metrics.scriptEncodedBytes}`,
      );
      await context.close();
    }
  await account.dispose();
} finally {
  if (browser) await browser.close();
  await writeFile(
    out + '/web-vitals.json',
    JSON.stringify(
      {
        scope:
          'MEASURED local production Next + Chromium. Cold browser contexts, synthetic partial database, no production CPU/field INP/device certification.',
        network: {
          mobile: { downMbps: 1.6, upMbps: 0.75, rttMs: 100, cpuSlowdown: 4 },
          desktop: { downMbps: 10, upMbps: 5, rttMs: 40, cpuSlowdown: 1 },
        },
        results,
      },
      null,
      2,
    ) + '\n',
  );
  if (child.exitCode === null) {
    const exited = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await exited;
  }
  log.end();
}
