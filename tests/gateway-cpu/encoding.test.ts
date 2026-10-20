import test from 'node:test';
import assert from 'node:assert/strict';
import executor from '../../workers/staging/transaction-api';
import { signOriginRequest, ORIGIN_HEADER } from '../../packages/security/origin-assertion';
import { configuration, publicOrigin, transactionSecret } from '../execution-boundary/fixture';
import { TRANSACTION_PATH } from '../../packages/security/transaction-boundary';

test('gateway BLOB conversion preserves exact bytes, scalar values and response shape', async () => {
  const bytes = Buffer.from([0, 1, 127, 128, 255]);
  let received: any[] = [];
  const env = {
    DD_TRANSACTION_BOUNDARY: 'true',
    DD_TRANSACTION_SECRET: transactionSecret,
    STAGING_ACCESS_HOST: new URL(publicOrigin).hostname,
    D1_USERS: {
      prepare() {
        return {
          bind(...args: any[]) {
            received = args;
            return {
              async all() {
                return {
                  success: true,
                  results: [
                    {
                      binary: new Uint8Array([0, 128, 255]).buffer,
                      native: [0, 128, 255],
                      text: '雪',
                      empty: null,
                    },
                  ],
                  meta: { rows_read: 1 },
                };
              },
            };
          },
        };
      },
    },
  };
  async function send(params: any[]) {
    const r = new Request(publicOrigin + TRANSACTION_PATH, {
      method: 'POST',
      body: JSON.stringify({
        owner: 'D1_USERS',
        batch: false,
        queries: [{ sql: 'SELECT 1', params }],
      }),
    });
    const signed = await signOriginRequest(r, configuration);
    return executor.fetch(
      new Request(r.url, {
        method: 'POST',
        headers: { [ORIGIN_HEADER]: signed.assertion },
        body: signed.body as BodyInit,
      }),
      env,
    );
  }
  const response = await send([{ blob: bytes.toString('base64') }, { blob: '' }, null, '雪', 3]);
  assert.equal(response.status, 200);
  assert.deepEqual(Array.from(new Uint8Array(received[0])), Array.from(bytes));
  assert.equal(received[1].byteLength, 0);
  assert.deepEqual(received.slice(2), [null, '雪', 3]);
  assert.deepEqual((await response.json()).result[0].results[0], {
    binary: [0, 128, 255],
    native: [0, 128, 255],
    text: '雪',
    empty: null,
  });
  for (const blob of ['Zg=', 'Z===', 'Zg==\n', '_w==', '!!!!', '====', 'Zg==AAAA']) {
    received = [];
    assert.equal((await send([{ blob }])).status, 409, 'malformed encoding denied');
    assert.deepEqual(received, [], 'no statement binds after invalid input');
  }
  assert.equal((await send([{ blob: 'Zg==', extra: true }])).status, 409);
});
