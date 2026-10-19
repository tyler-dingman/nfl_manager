import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { passwordEngine } from './implementation.ts';
import { hash, verify } from '@node-rs/argon2';

test('static Wasm Argon2id matches preserved native PHC hashes, unicode, invalid passwords and concurrent requests', async () => {
  const modules = Object.fromEntries(
    await Promise.all(
      ['argon2', 'blake2b'].map(async (name) => [
        name,
        new WebAssembly.Module(
          await readFile(new URL('./vendor/' + name + '.wasm', import.meta.url)),
        ),
      ]),
    ),
  );
  const engine = passwordEngine(modules),
    password = 'synthetic-🏈-pássword';
  const native = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
  assert(await engine.verify(native, password));
  assert.equal(await engine.verify(native, 'incorrect'), false);
  const encoded = await engine.hash(password);
  assert.match(encoded, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert(await verify(encoded, password));
  assert(
    (await Promise.all([engine.verify(native, password), engine.verify(encoded, password)])).every(
      Boolean,
    ),
  );
  assert.equal(await engine.verify('malformed', password), false);
});
