import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTraces } from './summarize-worker-traces.mjs';
test('Cloudflare CPU export parser rejects wall-only timings and strips private URLs', () => {
  const result = summarizeTraces([
    { wallMs: 12, route: '/' },
    {
      CPUTimeMs: 4,
      WallTimeMs: 900,
      Event: { request: { url: 'https://example.invalid/api/auth/reset-password?token=secret' } },
    },
    {
      CPUTimeMs: 8,
      WallTimeMs: 12,
      Event: { request: { url: 'https://example.invalid/api/auth/me' } },
    },
  ]);
  assert.equal(result.rejected, 1);
  assert.equal(result.groups[0].cpuP95Ms, 8);
  assert.equal(result.groups[0].wallP95Ms, 900);
  assert.equal(result.groups[0].route, '/api/auth');
  assert(!JSON.stringify(result).includes('secret'));
});
