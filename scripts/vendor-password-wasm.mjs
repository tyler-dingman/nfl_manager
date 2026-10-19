/** Deterministic loader-only adaptation of hash-wasm 4.12.0, MIT. */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = process.argv[2];
if (!source) throw Error('Pass extracted hash-wasm 4.12.0 package directory');
const pkg = JSON.parse(await readFile(source + '/package.json'));
if (pkg.version !== '4.12.0') throw Error('Unexpected package version');
let text = await readFile(source + '/dist/index.esm.js', 'utf8');
const upstream = createHash('sha256').update(text).digest('hex');
for (const name of ['argon2', 'blake2b']) {
  const match = text.match(
    new RegExp('var name(\\$[a-z]+) = "' + name + '";\\nvar data\\1 = "([A-Za-z0-9+/=]+)";'),
  );
  if (!match) throw Error('Pinned binary layout changed');
  await writeFile(`workers/password/vendor/${name}.wasm`, Buffer.from(match[2], 'base64'));
  text = text.replace(
    'var data' + match[1] + ' = "' + match[2] + '";',
    'var data' + match[1] + ' = "";',
  );
}
const find =
  'const asm = decodeBase64(binary.data);\n                const promise = WebAssembly.compile(asm);';
if (!text.includes(find)) throw Error('Pinned loader layout changed');
text = text.replace(
  find,
  'const module = modules[binary.name];\n                if (!module) throw Error("Missing static Wasm module");\n                const promise = Promise.resolve(module);',
);
text = text.replace(/export \{[^}]+\};\s*$/, 'return {argon2id};');
text =
  '// Loader-only adaptation; see provenance.json and LICENSE.\nexport function createArgon2(modules) {\n' +
  text +
  '\n}\n';
// Keep only the used Argon2/BLAKE2 implementation. No algorithm changes.
const { build } = await import('esbuild');
await build({
  stdin: { contents: text, resolveDir: process.cwd(), sourcefile: 'hash-wasm-4.12.0-static.mjs' },
  outfile: 'workers/password/vendor/argon2.mjs',
  bundle: true,
  format: 'esm',
  minify: true,
  platform: 'neutral',
  target: 'es2022',
});
await copyFile(source + '/LICENSE', 'workers/password/vendor/LICENSE');
const files = ['argon2.mjs', 'argon2.wasm', 'blake2b.wasm'];
await writeFile(
  'workers/password/vendor/provenance.json',
  JSON.stringify(
    {
      package: 'hash-wasm',
      version: pkg.version,
      source: 'https://github.com/Daninet/hash-wasm',
      upstreamEsmSha256: upstream,
      changes:
        'Static precompiled module injection only; exported argon2id only; unused algorithms eliminated by esbuild',
      files: Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile('workers/password/vendor/' + file))
              .digest('hex'),
          ]),
        ),
      ),
    },
    null,
    2,
  ) + '\n',
);
