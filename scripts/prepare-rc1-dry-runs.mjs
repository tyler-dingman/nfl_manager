/** Compile review templates only. This script cannot deploy or discover credentials. */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
const out = 'reports/release-candidate/build';
await mkdir(out, { recursive: true });
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
  CI: 'true',
  NODE_OPTIONS: '--require ./scripts/phase-two-network-guard.cjs',
});
const results = [];
for (const role of ['password', 'api', 'web', 'odds-processor', 'application']) {
  const dir = await mkdtemp('/private/tmp/dd-rc1-dry-');
  try {
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'deploy',
        '--dry-run',
        '--config',
        `config/rc1.${role}.toml`,
        '--outdir',
        dir,
      ],
      { env, encoding: 'utf8', maxBuffer: 10000000 },
    );
    await writeFile(`${out}/${role}-dry-run.log`, result.stdout + result.stderr);
    results.push({ role, exitCode: result.status, deployed: false });
    if (result.status !== 0) throw Error(`${role} dry run failed`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
await writeFile(out + '/dry-runs.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
