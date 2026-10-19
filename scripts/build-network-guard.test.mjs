import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('isolated build network guard rejects non-font application/provider hosts before connecting', () => {
  for (const url of [
    'https://api.cloudflare.com/client/v4/',
    'https://api.resend.com/emails',
    'http://example.invalid/',
  ]) {
    const code = `try {require(${JSON.stringify(url.startsWith('https:') ? 'node:https' : 'node:http')}).get(${JSON.stringify(url)});process.exitCode=1;}catch(e){if(!/disabled/.test(e.message))throw e;}`;
    const r = spawnSync(
      process.execPath,
      ['--require', './scripts/build-network-guard.cjs', '-e', code],
      { encoding: 'utf8', timeout: 5000 },
    );
    assert.equal(r.status, 0, r.stderr);
  }
});
