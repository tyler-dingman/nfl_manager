import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';
test('runtime has only local source imports and no PostgreSQL, provider, or shared app dependencies', async () => {
  const root = new URL('../src/', import.meta.url);
  for (const file of await readdir(root))
    if (file.endsWith('.ts')) {
      const source = await readFile(new URL(file, root), 'utf8');
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        assert(match[1].startsWith('./'), `${file} imports ${match[1]}`);
      }
      assert(!source.includes('DATABASE_URL'));
      assert(!/\bfetch\s*\(/.test(source.replace('async fetch(', 'async handler(')));
    }
});
test('local command launcher refuses remote flags and deploy modes', () => {
  for (const args of [['migrate', '--remote'], ['dev', '--remote'], ['deploy']]) {
    const result = spawnSync(process.execPath, ['scripts/local.mjs', ...args], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Only dev, migrate and build/);
  }
});
