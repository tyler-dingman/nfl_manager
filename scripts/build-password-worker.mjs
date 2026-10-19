import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('workers/password/dist/vendor', { recursive: true });
await build({
  entryPoints: ['workers/password/index.ts'],
  outfile: 'workers/password/dist/index.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  external: ['node:*', '*.wasm'],
  minify: true,
});
for (const file of ['argon2', 'blake2b'])
  await copyFile(
    `workers/password/vendor/${file}.wasm`,
    `workers/password/dist/vendor/${file}.wasm`,
  );
