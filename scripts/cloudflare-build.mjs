import { spawnSync } from 'node:child_process';
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  APP_RUNTIME: 'cloudflare',
  NEXT_TELEMETRY_DISABLED: '1',
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
  DATABASE_URL: '',
  PRODUCTION_DATABASE_URL: '',
  INFRASTRUCTURE_COST_POLICY: 'zero-cost',
});
const build = spawnSync(
  process.execPath,
  [
    'node_modules/@opennextjs/cloudflare/dist/cli/index.js',
    'build',
    '--config',
    'wrangler.phase-four.toml',
    '--skipWranglerConfigCheck',
  ],
  { env, stdio: 'inherit' },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const dry = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'deploy',
    '--dry-run',
    '--config',
    'wrangler.phase-four.toml',
    '--outdir',
    'workers/web/dist',
  ],
  { env, stdio: 'inherit' },
);
process.exit(dry.status ?? 1);
