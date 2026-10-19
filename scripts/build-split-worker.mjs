/** Local-only experiment. Never deploys or reads application credentials. */
import { readdir, mkdir, writeFile, cp, symlink, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
const root = process.cwd();
const files = [];
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) await scan(p);
    else if (item.name === 'route.ts') files.push(p);
  }
}
await scan('src/app/api');
const routes = files
  .map((file, i) => {
    const route = '/' + path.dirname(file).replace(/^src\/app\//, '');
    const names = [];
    const expression = route
      .split('/')
      .map((part) => {
        if (/^\[\.\.\./.test(part)) {
          names.push(part.slice(4, -1));
          return '(.+)';
        }
        if (/^\[/.test(part)) {
          names.push(part.slice(1, -1));
          return '([^/]+)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return { file, i, route, names, expression };
  })
  .sort((a, b) => a.names.length - b.names.length || b.route.length - a.route.length);
await mkdir('workers/api', { recursive: true });
await writeFile(
  'workers/api/routes.generated.ts',
  files.map((f, i) => `import * as r${i} from '../../${f.slice(0, -3)}';`).join('\n') +
    '\nexport const routes = [\n' +
    routes
      .map(
        (r) =>
          `{pattern:new RegExp(${JSON.stringify('^' + r.expression + '/?$')}), names:${JSON.stringify(r.names)}, handlers:r${r.i}}`,
      )
      .join(',\n') +
    '\n];\n',
);
const result = await build({
  entryPoints: ['workers/api/index.ts'],
  outfile: 'workers/api/dist/worker.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  minify: true,
  external: ['node:*', 'cloudflare:*'],
  define: { __dirname: JSON.stringify('/') },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire('/worker.js');",
  },
  alias: { '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api' },
  plugins: [
    {
      name: 'worker-password',
      setup(b) {
        b.onResolve({ filter: /argon-node$/ }, () => ({
          path: path.join(root, 'src/server/auth/argon-worker.ts'),
        }));
      },
    },
  ],
});
const apiBytes = (await readFile('workers/api/dist/worker.mjs')).length;
const apiGzip = gzipSync(await readFile('workers/api/dist/worker.mjs')).length;
await writeFile(
  'reports/production-completion/api-bundle.json',
  JSON.stringify(
    { routes: routes.length, bytes: apiBytes, gzipBytes: apiGzip, freeLimitBytes: 3 * 1024 * 1024 },
    null,
    2,
  ) + '\n',
);
if (process.argv.includes('--api-only')) process.exit(0);
const stage = await mkdtemp('/private/tmp/dd-split-web-');
try {
  await cp(root, stage, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src);
      return (
        !/^(\.git|node_modules|\.next|\.open-next|workers\/.*\/node_modules)(\/|$)/.test(rel) &&
        !rel.split(path.sep).includes('node_modules') &&
        !rel.startsWith('src/app/api')
      );
    },
  });
  const dependencies = spawnSync('cp', [
    '-cR',
    await (await import('node:fs/promises')).realpath(path.join(root, 'node_modules')),
    path.join(stage, 'node_modules'),
  ]);
  if (dependencies.status !== 0) throw Error('Dependency clone failed');
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  Object.assign(env, {
    APP_RUNTIME: 'cloudflare',
    CLOUDFLARE_API_TOKEN: '',
    CLOUDFLARE_ACCOUNT_ID: '',
    NEXT_TELEMETRY_DISABLED: '1',
    WRANGLER_SEND_METRICS: 'false',
  });
  const run = spawnSync(
    process.execPath,
    [
      'node_modules/@opennextjs/cloudflare/dist/cli/index.js',
      'build',
      '--config',
      'wrangler.phase-four.toml',
      '--skipWranglerConfigCheck',
    ],
    { cwd: stage, env, stdio: 'inherit' },
  );
  if (run.status !== 0) throw Error('Web build failed with status ' + run.status);
  await cp(path.join(stage, '.open-next'), '.open-next', { recursive: true });
  const dry = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'deploy',
      '--dry-run',
      '--config',
      'wrangler.split-local.toml',
      '--outdir',
      'workers/web/dist',
    ],
    { env, stdio: 'inherit' },
  );
  await writeFile(
    'reports/production-completion/split-build.json',
    JSON.stringify(
      { stage, apiBytes, apiGzip, dryRunStatus: dry.status, productionDeployment: false },
      null,
      2,
    ) + '\n',
  );
  if (dry.status !== 0) throw Error('Web dry run failed with status ' + dry.status);
} finally {
  await rm(stage, { recursive: true, force: true });
}
