import { spawnSync } from 'node:child_process';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  worker = new URL('../workers/content-engine/', import.meta.url),
  out = new URL('../reports/staging-readiness/', import.meta.url);
await mkdir(out, { recursive: true });
const files = [];
for (const directory of ['test', 'test-node'])
  for (const file of await readdir(new URL(`${directory}/`, worker)))
    if (file.endsWith('.test.ts')) files.push(`${directory}/${file}`);
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  NODE_ENV: 'test',
  AUTH_JWT_SECRET: 'synthetic-worker-test-key-at-least-32-characters',
  TSX_TSCONFIG_PATH: root + 'tsconfig.test.json',
  NEXT_TELEMETRY_DISABLED: '1',
  INFRASTRUCTURE_COST_POLICY: 'zero-cost',
});
const legacyPaths = [
  'reports/zero-cost-phase-3/cross-store-rehearsal.json',
  'reports/zero-cost-phase-3/d1-route-metrics.json',
];
const originals = await Promise.all(
  legacyPaths.map((p) => readFile(new URL('../' + p, import.meta.url))),
);
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-timeout=120000', '--test-concurrency=1', ...files.sort()],
  { cwd: worker, env, encoding: 'utf8', maxBuffer: 20000000 },
);
await writeFile(new URL('d1-all-tests.log', out), result.stdout + result.stderr);
for (let i = 0; i < legacyPaths.length; i++) {
  const path = new URL('../' + legacyPaths[i], import.meta.url);
  await writeFile(new URL(legacyPaths[i].split('/').at(-1), out), await readFile(path));
  await writeFile(path, originals[i]);
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);
