import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const state = await mkdtemp('/private/tmp/dd-final-migrations-');
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
const run = (args) => {
  const r = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      ...args,
      '--local',
      '--config',
      'wrangler.api-local.toml',
      '--persist-to',
      state,
    ],
    { env, encoding: 'utf8', maxBuffer: 8000000 },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout;
};
try {
  const first = run(['d1', 'migrations', 'apply', 'APP_DB']),
    second = run(['d1', 'migrations', 'apply', 'APP_DB']);
  assert.match(second, /No migrations to apply/i);
  const counts = JSON.parse(
    run([
      'd1',
      'execute',
      'APP_DB',
      '--command',
      'SELECT COUNT(*) AS count FROM d1_migrations',
      '--json',
    ]),
  );
  assert.equal(counts[0].results[0].count, 38);
  const fk = JSON.parse(
    run(['d1', 'execute', 'APP_DB', '--command', 'PRAGMA foreign_key_check', '--json']),
  );
  assert.deepEqual(fk[0].results, []);
  await mkdir('reports/final-staging', { recursive: true });
  await writeFile(
    'reports/final-staging/migration-repeatability.json',
    JSON.stringify(
      {
        localOnly: true,
        databaseUrlPresent: false,
        migrations: 38,
        secondApply: 'no pending migrations',
        foreignKeyViolations: fk[0].results,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(state, { recursive: true, force: true });
}
