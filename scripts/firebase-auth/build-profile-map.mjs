import { createHash } from 'node:crypto';
/** Local-only experiment. Never deploys or reads application credentials. */
import { readdir, mkdir, writeFile, cp, symlink, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { constants as fsConstants } from 'node:fs';
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
  outfile: '/private/tmp/dd-api-profile/worker.mjs',
  sourcemap: 'external',
  sourcesContent: false,
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
const apiBytes = (await readFile('/private/tmp/dd-api-profile/worker.mjs')).length;
const apiGzip = gzipSync(await readFile('/private/tmp/dd-api-profile/worker.mjs')).length;
if (apiBytes > 64 * 1024 * 1024)
  throw Error('API Worker exceeds current uncompressed bundle limit');
await writeFile(
  'reports/firebase-cpu-root-cause/mapped-build.json',
  JSON.stringify(
    {
      routes: routes.length,
      bytes: apiBytes,
      gzipBytes: apiGzip,
      freeUncompressedLimitBytes: 64 * 1024 * 1024,
      compressedLimitBytes: null,
    },
    null,
    2,
  ) + '\n',
);

console.log('Source map built without changing application source.');

const mapped = await readFile('/private/tmp/dd-api-profile/worker.mjs');
const deployed = await readFile('workers/api/dist/worker.mjs');
if (!mapped.equals(deployed)) throw Error('Source map does not match the current API bundle');
console.log(
  'Byte-identical API source map verified: ' + createHash('sha256').update(mapped).digest('hex'),
);
