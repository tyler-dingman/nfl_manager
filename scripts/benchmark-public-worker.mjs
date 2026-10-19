import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const phase = process.env.PERFORMANCE_PHASE ?? 'before',
  out = `reports/performance/${phase}`;
await mkdir(out, { recursive: true });
const directory = await mkdtemp('/private/tmp/dd-performance-worker-');
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
const cli = ['node_modules/wrangler/bin/wrangler.js'];
const migration = spawnSync(
  process.execPath,
  [
    ...cli,
    'd1',
    'migrations',
    'apply',
    'APP_DB',
    '--local',
    '--config',
    'wrangler.api-local.toml',
    '--persist-to',
    directory,
  ],
  { env, encoding: 'utf8' },
);
assert.equal(migration.status, 0, migration.stderr + migration.stdout);
const socket = createServer();
await new Promise((r) => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const base = `http://localhost:${port}`,
  log = createWriteStream(out + '/public-worker.log');
let child;
async function start(version) {
  child = spawn(
    process.execPath,
    [
      ...cli,
      'dev',
      '--local',
      '--config',
      'wrangler.api-local.toml',
      '--config',
      'workers/password/wrangler.toml',
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--persist-to',
      directory,
      '--var',
      'APP_PUBLIC_CACHE_ENABLED:true',
      '--var',
      `APP_CACHE_VERSION:${version}`,
      '--var',
      'PRELAUNCH_MODE:false',
      '--var',
      'AUTH_JWT_SECRET:synthetic-performance-secret-at-least-32-characters',
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/auth/config')).ok) return;
    } catch {}
    if (child.exitCode !== null) throw Error('Worker failed to start');
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error('Worker startup timeout');
}
async function stop() {
  if (child?.exitCode === null) {
    const done = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await done;
  }
}
const samples = [];
try {
  await start('benchmark-v1');
  for (let i = 0; i < 30; i++) {
    const t = performance.now(),
      r = await fetch(base + '/api/parlay-lab/events');
    assert.equal(r.status, 200);
    const body = await r.json();
    assert(Array.isArray(body.events));
    samples.push({
      ms: performance.now() - t,
      cache: r.headers.get('x-application-cache'),
      policy: r.headers.get('cache-control'),
    });
    await new Promise((r) => setTimeout(r, 15));
  }
  const isolation = [];
  for (const [path, headers] of [
    ['/api/parlay-lab/events', { cookie: 'dd_session=invalid-synthetic' }],
    ['/api/parlay-lab/events', { authorization: 'Bearer invalid-synthetic' }],
    ['/api/auth/me', {}],
    ['/api/parlay-lab/events?user=other', {}],
  ]) {
    const r = await fetch(base + path, { headers });
    await r.text();
    assert.notEqual(r.headers.get('x-application-cache'), 'HIT');
    assert.match(r.headers.get('cache-control'), /private|no-store/);
    isolation.push({ path, status: r.status, cache: r.headers.get('x-application-cache') });
  }
  if (phase.startsWith('after')) {
    assert.equal(samples[0].cache, 'MISS');
    assert(samples.slice(1).every((s) => s.cache === 'HIT'));
    await stop();
    await start('benchmark-v2');
    const r = await fetch(base + '/api/parlay-lab/events');
    assert.equal(r.headers.get('x-application-cache'), 'MISS');
    await r.text();
  }
  const sorted = samples
    .slice(1)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  await writeFile(
    out + '/public-api.json',
    JSON.stringify(
      {
        runtime: 'actual local workerd, empty synthetic precomputed odds board, loopback only',
        databaseUrlPresent: false,
        phase,
        samples,
        p50Ms: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        hitRate: samples.filter((s) => s.cache === 'HIT').length / samples.length,
        isolation,
        hostedCpuMs: null,
        geographicalLatency: null,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await stop();
  log.end();
  await rm(directory, { recursive: true, force: true });
}
