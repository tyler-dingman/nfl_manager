import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory = await mkdtemp('/private/tmp/dd-final-denial-'),
  socket = createServer();
await new Promise((r) => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
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
const child = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--config',
    '.staging/web.json',
    '--config',
    '.staging/api.json',
    '--config',
    '.staging/password.json',
    '--port',
    String(port),
    '--ip',
    '127.0.0.1',
    '--persist-to',
    directory,
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let log = '';
child.stdout.on('data', (b) => (log += b));
child.stderr.on('data', (b) => (log += b));
try {
  const base = `http://localhost:${port}`;
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(base);
      if (r.status === 403) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) throw Error('Worker failed: ' + log.slice(-2000));
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, 'Staging denial readiness failed');
  const chunk = (await readdir('.open-next/assets/_next/static/chunks')).find((p) =>
    p.endsWith('.js'),
  );
  const checks = [];
  for (const path of ['/', '/api/auth/config', '/_next/static/chunks/' + chunk]) {
    const response = await fetch(base + path, {
      headers: { 'Cf-Access-Authenticated-User-Email': 'forged@example.invalid' },
    });
    assert.equal(response.status, 403);
    assert.match(response.headers.get('cache-control'), /no-store/);
    checks.push({ path, status: response.status });
  }
  await writeFile(
    'reports/final-staging/full-staging-denial.json',
    JSON.stringify(
      {
        runtime: 'actual generated staging web/API/password configs via local workerd',
        checks,
        postgresAbsent: true,
        noRemoteAccess: true,
      },
      null,
      2,
    ),
  );
} finally {
  if (child.exitCode === null) {
    const stopped = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await stopped;
  }
  await rm(directory, { recursive: true, force: true });
}
