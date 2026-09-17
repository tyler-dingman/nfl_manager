import assert from 'node:assert/strict';
import test from 'node:test';
import { configuration, run } from './content-ingestion-request.mjs';
const env = {
  BASE_URL: 'https://downdistance.com',
  AUTOMATION_SECRET: 'test-token',
  GROUP: 'video',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const check = () => json({ ok: true, service: 'content-automation', authenticated: true });
test('canonicalizes known host and rejects malformed settings', () => {
  assert.equal(configuration(env).url.hostname, 'www.downdistance.com');
  for (const BASE_URL of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com?token=x',
  ])
    assert.throws(() => configuration({ ...env, BASE_URL }));
  for (const AUTOMATION_SECRET of ['', ' token', 'token\n', '"token"'])
    assert.throws(() => configuration({ ...env, AUTOMATION_SECRET }));
});
test('authenticates before ingestion and never follows redirects', async () => {
  const methods = [];
  await run(env, async (url, options) => {
    methods.push(options.method);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return options.method === 'GET' ? check() : json({ ok: true, failedJobs: 0 });
  });
  assert.deepEqual(methods, ['GET', 'POST']);
});
test('preflight failures never POST or retry and do not leak response data', async () => {
  for (const status of [301, 307, 401, 403, 503]) {
    let calls = 0;
    await assert.rejects(
      run(env, async () => {
        calls++;
        return json({ error: 'test-token' }, status);
      }),
      (error) => !error.message.includes('test-token'),
    );
    assert.equal(calls, 1);
  }
});
test('check-only does not ingest', async () => {
  let calls = 0;
  await run({ ...env, CHECK_ONLY: 'true' }, async () => {
    calls++;
    return check();
  });
  assert.equal(calls, 1);
});
test('rejects wrong preflight contract and failed ingestion jobs', async () => {
  await assert.rejects(
    run(env, async () => json({ ok: true })),
    /contract missing/,
  );
  await assert.rejects(
    run(env, async (_, options) =>
      options.method === 'GET' ? check() : json({ ok: true, failedJobs: 2 }),
    ),
    /failed jobs/,
  );
});
