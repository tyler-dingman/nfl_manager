import { symlink, realpath } from 'node:fs/promises';
/** Isolated Node build only. No Cloudflare/Render credentials or deployment commands. */
import { readFile, writeFile, mkdir, cp, rm, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { build } from 'esbuild';
const root = process.cwd(),
  out = path.join(root, '.staging/render-node');
await mkdir(out, { recursive: true });
// Reuse the existing API route discovery and compilation, retaining every handler.
let compiler = (await readFile('scripts/build-split-worker.mjs', 'utf8')).split(
  "if (process.argv.includes('--api-only'))",
)[0];
compiler = compiler
  .replace("outfile: 'workers/api/dist/worker.mjs'", `outfile: ${JSON.stringify(out + '/api.mjs')}`)
  .replace(
    "external: ['node:*', 'cloudflare:*']",
    "external: ['node:*', 'cloudflare:*', '@node-rs/argon2']",
  )
  .replaceAll(
    "await readFile('workers/api/dist/worker.mjs')",
    `await readFile(${JSON.stringify(out + '/api.mjs')})`,
  )
  .replace(
    "'reports/production-completion/api-bundle.json'",
    "'reports/render-free-prototype/node-api-bundle.json'",
  );
// Node retains the real Argon module for rollback; Firebase staging still disables it.
compiler = compiler.replace('/argon-node$/', '/argon-never-replaced-in-node$/');
await writeFile(out + '/build-api.mjs', compiler);
const api = spawnSync(process.execPath, [out + '/build-api.mjs'], { cwd: root, stdio: 'inherit' });
if (api.status) throw Error('Node API build failed');
await build({
  entryPoints: ['src/server/node-staging/start.ts'],
  outfile: out + '/start.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['next', 'node:*', out + '/api.mjs'],
  plugins: [
    {
      name: 'built-api',
      setup(b) {
        b.onResolve({ filter: /\.staging\/render-node\/api\.mjs$/ }, () => ({
          path: './api.mjs',
          external: true,
        }));
      },
    },
  ],
});
if (process.argv.includes('--api-only')) process.exit(0);
const stage = await mkdtemp(path.join(os.tmpdir(), 'dd-node-build-'));
try {
  await cp(root, stage, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    filter: (src) => {
      const rel = path.relative(root, src);
      return (
        !/^(\.git|node_modules|\.next|\.open-next|\.staging)(\/|$)/.test(rel) &&
        !rel.split(path.sep).includes('node_modules') &&
        !rel
          .split(path.sep)
          .some((part) => part.startsWith('.env') || ['.aws', '.codex'].includes(part))
      );
    },
  });
  await cp(root + '/node_modules', stage + '/node_modules', {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
  });
  await mkdir(stage + '/workers/content-engine', { recursive: true });
  await symlink(
    await realpath(root + '/workers/content-engine/node_modules'),
    stage + '/workers/content-engine/node_modules',
    'dir',
  );
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  Object.assign(env, {
    APP_RUNTIME: 'node',
    APP_DATA_BACKEND: 'd1',
    AUTH_PROVIDER: 'firebase',
    APP_PASSWORD_ENABLED: 'false',
    DD_NODE_STAGING: 'true',
    DD_ISOLATED_BUILD: 'true',
    DD_BUILD_COPY_ROOT: stage,
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: '--require ./scripts/build-isolation.cjs',
    WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_API_TOKEN: '',
    DATABASE_URL: '',
  });
  const run = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    cwd: stage,
    env,
    stdio: 'inherit',
  });
  if (run.status) throw Error('Node Next build failed');
  const app = out + '/app';
  await rm(app, { recursive: true, force: true });
  await mkdir(app, { recursive: true });
  for (const file of ['.next', 'public', 'next.config.mjs', 'package.json'])
    await cp(stage + '/' + file, app + '/' + file, {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
    });
  await rm(out + '/assets', { recursive: true, force: true });
  await cp(stage + '/public', out + '/assets', { recursive: true });
  await mkdir(out + '/assets/_next', { recursive: true });
  await cp(stage + '/.next/static', out + '/assets/_next/static', { recursive: true });
  console.log('Isolated Node API/SSR build complete; no deployment.');
} finally {
  await rm(stage, { recursive: true, force: true });
}
