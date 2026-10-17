import test from 'node:test';
import assert from 'node:assert/strict';
import { UnabatedClient } from './client';
import { oddsSchema } from './types';
import { flattenUnabatedProps } from './coverage';
import { trackedOddsLink, verifyFreeTransfer } from './deeplinks';
const success = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
test('documented authentication and discovery endpoint; secrets absent from errors', async () => {
  const client = new UnabatedClient({
    apiKey: 'test-secret',
    fetcher: async (url, init) => {
      assert.equal(url, 'https://data.unabated.com/league');
      assert.equal((init!.headers as Record<string, string>)['X-Api-Key'], 'test-secret');
      assert.equal(init?.redirect, 'error');
      return success([{ id: 1, name: 'nfl' }]);
    },
  });
  assert.equal((await client.leagues())[0].name, 'nfl');
  assert.equal(client.usage.requests, 1);
  const denied = new UnabatedClient({
    apiKey: 'test-secret',
    fetcher: async () => new Response('test-secret', { status: 403 }),
  });
  await assert.rejects(denied.leagues(), /HTTP 403: account tier or data scope denied/);
  assert.equal(denied.usage.requests, 1);
});
test('honors Retry-After and validates envelopes and payloads', async () => {
  const waits: number[] = [];
  let calls = 0;
  const client = new UnabatedClient({
    apiKey: 'retry-test',
    wait: async (ms) => {
      waits.push(ms);
    },
    fetcher: async () => {
      calls++;
      return calls === 1
        ? new Response('', { status: 429, headers: { 'Retry-After': '7' } })
        : success([]);
    },
  });
  await client.leagues();
  assert.deepEqual(waits, [7000]);
  assert.equal(client.usage.retries, 1);
  for (const body of [
    { success: false, data: [] },
    { success: true, data: [{ id: 'bad' }] },
  ]) {
    const bad = new UnabatedClient({
      apiKey: 'test',
      fetcher: async () => new Response(JSON.stringify(body)),
    });
    await assert.rejects(bad.leagues());
  }
});
test('serializes odds requests across client instances sharing a key', async () => {
  let time = 0;
  const waits: number[] = [];
  const options = {
    apiKey: 'shared-gate-test',
    now: () => time,
    wait: async (ms: number) => {
      waits.push(ms);
      time += ms;
    },
    fetcher: async () => success({ lastUpdated: 0, odds: {} }),
  };
  await Promise.all([new UnabatedClient(options).odds(), new UnabatedClient(options).odds()]);
  assert.ok(waits.includes(5000));
});
const line = {
  marketId: 10,
  marketLineId: 20,
  marketSourceId: 30,
  points: 199.5,
  price: -110,
  statusId: 1,
  freshnessExpiresAt: '2030-01-01T00:00:00Z',
  deepLink: 'https://www.gambly.com/deeplink/odds/30/20/199.5',
  partnerOddsData: { fanduel: { marketId: '42.123', selectionId: '456' } },
};
const board = oddsSchema.parse({
  lastUpdated: 1,
  odds: {
    arbitrary: {
      leagueId: 1,
      periodTypes: {
        arbitrary: {
          periodTypeId: 1,
          pregame: {
            arbitrary: {
              eventId: 1,
              eventStart: '2030-01-01T00:00:00Z',
              statusId: 1,
              isLive: false,
              betTypeId: 1,
              sides: {
                arbitrary: {
                  sideIndex: 0,
                  personId: 1,
                  marketSourceLines: {
                    arbitrary: {
                      ...line,
                      alternateLines: [
                        {
                          ...line,
                          points: 224.5,
                          price: -1000,
                          deepLink: null,
                          partnerOddsData: null,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
test('preserves alternate points and own link/IDs without parsing dictionary keys', () => {
  const rows = flattenUnabatedProps(board, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sportsbookSelectionId, '456');
  assert.equal(rows[1].sportsbookSelectionId, null);
  assert.equal(rows[1].deepLink, null);
  assert.equal(rows[1].points, 224.5);
  assert.equal(rows[1].price, -1000);
  assert.equal(rows[1].lineType, 'alternate');
  assert.equal(rows[1].marketLineId, 20);
});
test('tracked links preserve points and overwrite attribution without duplication', () => {
  const url = trackedOddsLink(line.deepLink + '?utm_campaign=old', 'our-partner')!;
  assert.equal(new URL(url).pathname, '/deeplink/odds/30/20/199.5');
  assert.deepEqual(new URL(url).searchParams.getAll('utm_campaign'), ['our-partner']);
  assert.equal(trackedOddsLink('https://sportsbook.fanduel.com/', 'partner'), null);
  assert.equal(trackedOddsLink(line.deepLink, ''), null);
});
test('only complete fresh Free-tier transfers succeed; SGP/expired/partial fail closed', async () => {
  const rows = flattenUnabatedProps(board, 0).slice(0, 1);
  let called = 0;
  const options = {
    now: 0,
    fanDuelSourceId: 30,
    partnerCode: 'partner',
    client: {
      deepLink: async (ids: number[], points: (number | null)[]) => {
        called++;
        assert.deepEqual(ids, [20]);
        assert.deepEqual(points, [199.5]);
        return { status: 0, statusString: 'full_support', ids: [20], url: line.deepLink };
      },
    },
  };
  assert.equal((await verifyFreeTransfer(rows, options)).supported, true);
  assert.equal((await verifyFreeTransfer([...rows, ...rows], options)).supported, false);
  assert.equal(
    (await verifyFreeTransfer([{ ...rows[0], available: false }], options)).supported,
    false,
  );
  assert.equal(
    (await verifyFreeTransfer([{ ...rows[0], freshnessExpiresAt: null }], options)).supported,
    false,
  );
  assert.equal(called, 1);
  assert.equal(
    (
      await verifyFreeTransfer(rows, {
        ...options,
        client: {
          deepLink: async () => ({
            status: 3,
            statusString: 'partial_support',
            ids: [20],
            url: line.deepLink,
          }),
        },
      })
    ).supported,
    false,
  );
  assert.equal(
    (
      await verifyFreeTransfer(rows, {
        ...options,
        client: {
          deepLink: async () => ({
            status: 0,
            statusString: 'full_support',
            ids: [99],
            url: line.deepLink,
          }),
        },
      })
    ).supported,
    false,
  );
});
