import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
test(
  'actual workerd authentication: registration, native verification, reset, expiry, isolation, concurrent sessions and restart',
  { timeout: 120000 },
  async () => {
    const env = Object.fromEntries(
      ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
        .filter((k) => process.env[k])
        .map((k) => [k, process.env[k]]),
    );
    await promisify(execFile)(process.execPath, ['scripts/probe-staging-auth.mjs'], {
      cwd: new URL('../../../', import.meta.url),
      env,
      timeout: 115000,
      maxBuffer: 1000000,
    });
    const result = JSON.parse(
      await readFile(
        new URL('../../../reports/staging-readiness/password-runtime.json', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(result.databaseUrlPresent, false);
    assert.equal(result.nativePhcCompatible, true);
    assert.equal(result.scenarios.length, 10);
  },
);
