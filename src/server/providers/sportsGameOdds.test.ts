import assert from 'node:assert/strict';
import test from 'node:test';
import { SportsGameOddsClient } from './sportsGameOdds';

const usageResponse = (used: number) =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        tier: 'amateur',
        rateLimits: {
          'per-month': { 'max-entities': 2500, 'current-entities': used },
        },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

test('usage guard stops before a data request at the local monthly ceiling', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    urls.push(String(input));
    return usageResponse(1000);
  };
  const client = new SportsGameOddsClient('test-key', fetcher);

  await assert.rejects(
    client.getEvent('event-1'),
    /Local monthly safety ceiling reached \(1000\/1000 objects\)/,
  );
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/account\/usage$/);
});

test('usage guard permits data requests well below the local ceiling', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/account/usage')) return usageResponse(100);
    return new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new SportsGameOddsClient('test-key', fetcher);

  assert.deepEqual(await client.getEvent('event-1'), []);
  assert.equal(urls.length, 2);
});

test('a full page cannot cross the monthly safety ceiling', async () => {
  const urls: string[] = [];
  const client = new SportsGameOddsClient('test-key', async (input) => {
    urls.push(String(input));
    return usageResponse(950);
  });
  await assert.rejects(
    client.getNflEvents({ startsAfter: '2026-09-17', startsBefore: '2026-09-24' }),
    /Insufficient monthly object budget/,
  );
  assert.equal(urls.length, 1);
});

test('a lower provider allowance also stops imports', async () => {
  let calls = 0;
  const client = new SportsGameOddsClient('test-key', async () => {
    calls++;
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          rateLimits: {
            'per-month': { 'max-entities': 50, 'current-entities': 50 },
          },
        },
      }),
    );
  });
  await assert.rejects(client.getEvent('event-1'), /50\/50 objects/);
  assert.equal(calls, 1);
});
