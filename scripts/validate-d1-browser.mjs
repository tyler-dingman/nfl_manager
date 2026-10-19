import { chromium, request } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createWriteStream } from 'node:fs';
import { writeFile, mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { checkD1Products } from './check-d1-product-workflows.mjs';
import assert from 'node:assert/strict';

const out = process.env.D1_BROWSER_REPORT_DIR ?? 'reports/d1-migration';
await mkdir(out, { recursive: true });
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const baseURL = `http://localhost:${port}`;
const directory = await mkdtemp('/private/tmp/dd-d1-browser-');
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  CI: 'true',
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
  NODE_OPTIONS: '--require ./scripts/phase-two-network-guard.cjs',
});
assert(!('DATABASE_URL' in env));
assert(!('PRODUCTION_DATABASE_URL' in env));
const apiConfig = directory + '/api.toml';
let api = await readFile(
  process.env.DD_NO_R2 === 'true'
    ? 'wrangler.api-no-billing-local.toml'
    : 'wrangler.api-local.toml',
  'utf8',
);
api = api
  .replace(
    'main = "workers/api/dist/worker.mjs"',
    `main = "${process.cwd()}/workers/api/dist/worker.mjs"`,
  )
  .replace(
    'migrations_dir = "workers/content-engine/migrations"',
    `migrations_dir = "${process.cwd()}/workers/content-engine/migrations"`,
  )
  .replace(
    '[vars]',
    `[vars]
APP_PASSWORD_ENABLED="true"\nCONTENT_AUTOMATION_SECRET="synthetic-migration-automation-secret"\nSTRIPE_SECRET_KEY="sk_test_synthetic_local_only"\nSTRIPE_WEBHOOK_SECRET="whsec_synthetic_local_only"
AUTH_JWT_SECRET="synthetic-d1-browser-secret-at-least-32-characters"
APP_MAIL_ENCRYPTION_KEY="synthetic-d1-browser-secret-at-least-32-characters"
PRELAUNCH_MODE="false"
AUTH_BASE_URL="${baseURL}"`,
  );
await writeFile(apiConfig, api);

const migrated = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'APP_DB',
    '--local',
    '--config',
    apiConfig,
    '--persist-to',
    directory,
  ],
  { env, encoding: 'utf8' },
);
await writeFile(out + '/browser-migrations.log', migrated.stdout + migrated.stderr);
assert.equal(migrated.status, 0);
const serverLog = createWriteStream(`${out}/local-server.log`);
let server;
const start = async () => {
  server = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--config',
      process.env.DD_NO_R2 === 'true'
        ? 'wrangler.no-billing-local.toml'
        : 'wrangler.split-local.toml',
      '--config',
      apiConfig,
      '--config',
      'workers/password/wrangler.toml',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      directory,
      '--var',
      'AUTH_JWT_SECRET:synthetic-d1-browser-secret-at-least-32-characters',
      '--var',
      'APP_PASSWORD_ENABLED:true',
      '--var',
      'APP_MAIL_ENCRYPTION_KEY:synthetic-d1-browser-secret-at-least-32-characters',
      '--var',
      'PRELAUNCH_MODE:false',
      '--var',
      `AUTH_BASE_URL:${baseURL}`,
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stdout.pipe(serverLog, { end: false });
  server.stderr.pipe(serverLog, { end: false });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${baseURL}/api/auth/config`)).ok) return;
    } catch {}
    if (server.exitCode !== null) throw Error('Local Next server exited before readiness');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('Local Next readiness timed out');
};
const stop = async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await exited;
  }
};
const checks = [],
  routes = [];
let browser, a, b;
try {
  await start();
  a = await request.newContext({ baseURL });
  b = await request.newContext({ baseURL });
  for (const [i, actor] of [a, b].entries()) {
    const response = await actor.post('/api/auth/signup', {
      headers: { origin: baseURL },
      data: {
        email: `browser-${i}@example.invalid`,
        password: 'synthetic-browser-password',
        displayName: `Synthetic ${i}`,
      },
    });
    assert.equal(response.status(), 201, await response.text());
    assert.equal((await actor.get('/api/auth/me')).status(), 200);
  }
  checks.push('real HTTP signup and opaque session validation for two owners');
  const state = await a.storageState();
  const session = state.cookies.find((c) => c.name === 'dd_session');
  assert(session);
  const trade = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', 'tests/trade-machine-api.test.ts'],
    {
      env: {
        ...env,
        NODE_ENV: 'test',
        AUTH_JWT_SECRET: 'synthetic-d1-browser-secret-at-least-32-characters',
        TSX_TSCONFIG_PATH: 'tsconfig.test.json',
        TRADE_TEST_BASE_URL: baseURL,
        TRADE_TEST_SESSION: session.value,
      },
      encoding: 'utf8',
    },
  );
  await writeFile(`${out}/trade-http-integration.log`, trade.stdout + trade.stderr);
  assert.equal(trade.status, 0, 'Trade HTTP contract failed; see trade-http-integration.log');
  checks.push('real authenticated versioned multi-route trade HTTP regression');
  checks.push(...(await checkD1Products(a, b, baseURL)));
  const saved = {
    contentType: 'STORY',
    contentId: 'saved-original-id',
    title: 'Synthetic original',
    href: '/the-beat/saved-original-id',
  };
  assert.equal((await a.post('/api/user/saved-content', { data: saved })).status(), 201);
  assert.equal(
    (
      await a.patch('/api/user/preferences', {
        headers: { origin: baseURL },
        data: { reducedMotion: true, preferredTeamId: 'KC' },
      })
    ).status(),
    200,
  );
  assert.equal((await b.get('/api/user/saved-content')).status(), 200);
  assert.equal((await (await b.get('/api/user/saved-content')).json()).items.length, 0);
  checks.push('saved content and preference mutations; second owner cannot read first owner saves');
  await stop();
  await start();
  assert.equal(
    (await (await a.get('/api/user/preferences')).json()).preferences.reducedMotion,
    true,
  );
  assert.equal(
    (await (await a.get('/api/user/saved-content')).json()).items[0].contentId,
    saved.contentId,
  );
  checks.push('sessions, preferences and saved original IDs survive actual workerd restart');
  const benchmarks = [];
  for (const [name, path, method, data] of [
    ['Homepage', '/'],
    ['The Beat', '/the-beat?team=kc'],
    ['Film Room', '/watch?team=kc'],
    ['AI Search', '/api/search', 'POST', { query: 'Mahomes', teamId: 'KC', includeAnswer: true }],
    ['Front Office', '/front-office'],
    ['Parlay Lab', '/parlay-lab'],
    ['Trending Props', '/api/parlay-lab/props'],
    ['Bet Slip', '/parlay-lab/my-plays'],
    ['Authentication', '/api/auth/me'],
    ['Editorial ingestion admission', '/api/automation/content', 'POST', {}],
  ]) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const response = method === 'POST' ? await a.post(path, { data }) : await a.get(path);
      samples.push({
        localHttpWallMs: performance.now() - start,
        status: response.status(),
        cache: response.headers()['cache-control'] ?? null,
      });
    }
    benchmarks.push({
      name,
      path,
      samples,
      workerCpuMs: null,
      note:
        name === 'Editorial ingestion admission'
          ? 'Admission rejection only; no source jobs or provider calls authorized'
          : 'Local D1/R2 fixtures only; response status retained. No provider traffic.',
    });
  }
  await writeFile(
    `${out}/route-benchmarks.json`,
    JSON.stringify(
      {
        scope:
          'MEASURED localhost workerd HTTP wall time. Not Cloudflare CPU. All response statuses retained, including unavailable paths.',
        benchmarks,
      },
      null,
      2,
    ),
  );
  if (process.env.D1_PERFORMANCE === 'true') {
    const stateFile = directory + '/performance-state.json';
    await writeFile(stateFile, JSON.stringify(await a.storageState()));
    const measured = await new Promise((resolve, reject) => {
      const probe = spawn(
        process.execPath,
        ['scripts/measure-staging-performance.mjs', baseURL, stateFile, `${out}/performance.json`],
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '',
        stderr = '';
      const timer = setTimeout(() => probe.kill('SIGTERM'), 600000);
      probe.stdout.on('data', (b) => (stdout += b));
      probe.stderr.on('data', (b) => (stderr += b));
      probe.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      probe.once('exit', (status) => {
        clearTimeout(timer);
        resolve({ status, stdout, stderr });
      });
    });
    await writeFile(`${out}/performance-run.log`, measured.stdout + measured.stderr);
    assert.equal(measured.status, 0, 'Local throttled performance probe failed');
  }
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ storageState: await a.storageState() });
  await context.route('**/*', (route) =>
    ['localhost', '127.0.0.1', '::1'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort('blockedbyclient'),
  );
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    for (const team of ['kc', 'sea']) {
      const selected = await context.request.put(baseURL + '/api/user/team-follows/primary', {
        headers: { origin: baseURL },
        data: { teamId: team.toUpperCase() },
      });
      assert.equal(selected.status(), 200, await selected.text());
      await page.goto(baseURL + '/account', { waitUntil: 'domcontentloaded' });
      await page.evaluate(
        (value) => localStorage.setItem('down-distance-fan-team', value),
        team.toUpperCase(),
      );
      for (const path of [
        `/?team=${team}`,
        `/the-beat?team=${team}`,
        `/watch?team=${team}`,
        `/parlay-lab?team=${team}`,
        '/account',
        '/three-and-out',
        '/huddle',
        '/trivia',
        '/rewards',
        '/front-office',
        '/login?resetToken=synthetic-reset-token-32-characters',
        '/login?verifyToken=synthetic-verification-token-32-chars',
      ]) {
        const startTime = performance.now();
        try {
          const response = await page.goto(`${baseURL}${path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(500);
          if (path.startsWith('/?team='))
            await page.locator('[data-hero-copy]').waitFor({ state: 'visible' });
          if (path.startsWith('/login?resetToken=')) {
            await page.getByLabel('Password', { exact: true }).fill('synthetic-password-fixture');
            await page
              .getByLabel('Confirm password', { exact: true })
              .fill('synthetic-password-fixture');
            await page.getByRole('button', { name: 'Update password' }).click();
            await page
              .getByRole('alert')
              .filter({ hasText: /invalid|expired/i })
              .waitFor();
            assert(!new URL(page.url()).searchParams.has('resetToken'));
          }
          if (path.startsWith('/login?verifyToken=')) {
            await page.getByRole('button', { name: 'Verify email', exact: true }).click();
            await page
              .getByRole('alert')
              .filter({ hasText: /invalid|expired/i })
              .waitFor();
            assert(!new URL(page.url()).searchParams.has('verifyToken'));
          }
          if (path.startsWith('/parlay-lab'))
            await page
              .getByRole('status')
              .filter({ hasText: /freshness|Odds as of/i })
              .waitFor();
          routes.push({
            path,
            width: viewport.width,
            status: response?.status(),
            finalPath: new URL(page.url()).pathname,
            wallMs: performance.now() - startTime,
            title: await page.title(),
            horizontalOverflow: await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            textExcerpt: (await page.locator('body').innerText()).slice(0, 120),
          });
          if (
            path.startsWith('/?') ||
            path.startsWith('/the-beat') ||
            path.startsWith('/login?') ||
            path.startsWith('/parlay-lab')
          )
            await page.screenshot({
              path: `${out}/${path.startsWith('/?') ? 'home' : path.startsWith('/the-beat') ? 'beat' : path.includes('resetToken') ? 'reset' : path.includes('verifyToken') ? 'verify' : 'parlay'}-${team}-${viewport.width}.png`,
              fullPage: true,
            });
        } catch (error) {
          routes.push({ path, width: viewport.width, error: error.message });
        }
      }
    }
    await page.close();
  }
  const anonymous = await request.newContext({ baseURL });
  assert.equal((await anonymous.get('/api/user/saved-content')).status(), 401);
  await anonymous.dispose();
  checks.push('anonymous private saved-content API is rejected');
  assert.ok(
    routes.every((route) => !route.error && route.status === 200 && !route.horizontalOverflow),
    'Some canonical routes failed or overflowed; inspect browser-results.json',
  );
} finally {
  await writeFile(
    `${out}/browser-results.json`,
    JSON.stringify(
      {
        scope: `MEASURED local Cloudflare workerd, D1${process.env.DD_NO_R2 === 'true' ? ' with no R2 bindings' : '/R2'} and synthetic accounts. DATABASE_URL absent. Chromium desktop/mobile viewport only; external network blocked. Not Android/iOS or provider validation.`,
        checks,
        routes,
      },
      null,
      2,
    ) + '\n',
  );
  await browser?.close();
  await a?.dispose();
  await b?.dispose();
  await stop();
  serverLog.end();
  await rm(directory, { recursive: true, force: true });
}
