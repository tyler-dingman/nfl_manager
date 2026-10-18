import { spawnSync } from 'node:child_process';
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  NEXT_TELEMETRY_DISABLED: '1',
  APP_RUNTIME: 'node',
  APP_DATA_BACKEND: 'postgres',
  DATABASE_URL: '',
  PRODUCTION_DATABASE_URL: '',
  INFRASTRUCTURE_COST_POLICY: 'zero-cost',
});
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
