/** Offline-only build of the two existing Worker roles; no remote configuration. */
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('.staging/transaction-boundary', { recursive: true });
await mkdir('reports/execution-boundary', { recursive: true });
const results = [];
for (const [name, entry] of [
  ['web', 'workers/staging/render-origin.ts'],
  ['api', 'workers/staging/transaction-api.ts'],
]) {
  const result = await build({
    entryPoints: [entry],
    outfile: `.staging/transaction-boundary/${name}.mjs`,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    minify: process.env.DD_GATEWAY_PROFILE_BUILD !== 'true',
    sourcemap: process.env.DD_GATEWAY_PROFILE_BUILD === 'true' ? 'inline' : false,
    metafile: true,
    external: ['node:*', 'cloudflare:*'],
  });
  results.push({
    name,
    bytes: Object.values(result.metafile.outputs)[0].bytes,
    inputs: Object.keys(result.metafile.inputs),
  });
}
await writeFile(
  'reports/execution-boundary/worker-build.json',
  JSON.stringify(results, null, 2) + '\n',
);
console.log('Private Web/API transaction boundary built locally');
