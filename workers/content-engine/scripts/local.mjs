import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2];
if (process.argv.length !== 3 || !['dev', 'migrate', 'build', 'build-lean'].includes(mode))
  throw Error('Only dev, migrate and build are supported. No forwarded flags or remote commands.');
const args =
  mode === 'dev'
    ? ['dev', '--local', '--ip', '127.0.0.1', '--port', '8797', '--persist-to', '.local/state']
    : mode === 'migrate'
      ? [
          'd1',
          'migrations',
          'apply',
          'editorial-local-poc',
          '--local',
          '--persist-to',
          '.local/state',
        ]
      : mode === 'build-lean'
        ? [
            'deploy',
            '--dry-run',
            '--config',
            'wrangler.zero-cost.toml',
            '--outdir',
            'dist/zero-cost',
          ]
        : ['deploy', '--dry-run', '--outdir', 'dist'];
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: 'true',
  WRANGLER_SEND_METRICS: 'false',
  WRANGLER_LOG_PATH: '.local/logs',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
};
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
  cwd: root,
  env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
