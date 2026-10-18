import test from 'node:test';
import assert from 'node:assert/strict';
import bridge from '../src/application-local-worker';
import { harness } from './harness';
import { digest, utf8, objectKey } from '../../../packages/storage/core';
test('synthetic SQL bridge rejects remote hosts, missing secrets, corrupt objects and oversized streamed bodies', async () => {
  const h = await harness();
  try {
    const token = 'synthetic-loopback-key-at-least-32-characters',
      env = {
        CONTENT_ENV: 'local',
        LOCAL_INGEST_TOKEN: token,
        EDITORIAL_DB: h.binding as unknown as D1Database,
        EDITORIAL_ARCHIVE: (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
      };
    const call = (url: string, body: string, bearer = token) =>
      bridge.fetch(
        new Request(url, { method: 'POST', headers: { authorization: `Bearer ${bearer}` }, body }),
        env,
      );
    assert.equal(
      (await call('https://production.example.invalid', JSON.stringify({ op: 'sql' }))).status,
      403,
    );
    assert.equal(
      (await call('http://localhost', JSON.stringify({ op: 'sql' }), 'incorrect')).status,
      403,
    );
    assert.equal((await call('http://localhost', 'x'.repeat(8000001))).status, 413);
    assert.equal(
      (
        await call(
          'http://localhost',
          JSON.stringify({
            op: 'sql',
            statements: [{ sql: 'SELECT count(*) AS count FROM nfl_teams', values: [] }],
          }),
        )
      ).status,
      200,
    );
    const bytes = utf8.encode('synthetic bytes'),
      key = objectKey(await digest(bytes));
    assert.equal(
      (await call('http://localhost', JSON.stringify({ op: 'put', key, bytes: [0] }))).status,
      409,
    );
    assert.equal(
      (await call('http://localhost', JSON.stringify({ op: 'put', key, bytes: Array.from(bytes) })))
        .status,
      200,
    );
    const response = await call('http://localhost', JSON.stringify({ op: 'get', key }));
    assert.deepEqual(await response.json(), Array.from(bytes));
  } finally {
    await h.close();
  }
});
