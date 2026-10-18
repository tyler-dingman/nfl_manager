import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { scheduledApplicationOdds } from '../../application/odds';
import { oddsFreshness, latestScheduledRefresh } from '../../../packages/parlay/freshness';
test('concrete odds adapter: exactly three weekly slots, dedupe, quota, partial coverage, interruption and stale disclosure', async () => {
  const h = await harness();
  try {
    const s = new Storage(
      h.binding as unknown as SqlDatabase,
      new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
    );
    let requests = 0,
      used = 0,
      fail = false;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/usage'))
        return Response.json({
          success: true,
          data: { rateLimits: { 'per-month': { 'current-entities': used, 'max-entities': 2500 } } },
        });
      requests++;
      if (fail) throw Error('Synthetic lost provider acknowledgement');
      assert.equal(url.searchParams.get('includeAltLines'), 'true');
      assert.equal(url.searchParams.get('bookmakerID'), 'fanduel,draftkings,betmgm,caesars');
      return Response.json({
        success: true,
        data: [
          {
            eventID: 'original-event',
            odds: {
              passing: {
                oddID: 'original-odd',
                byBookmaker: {
                  fanduel: { odds: -110, altLines: [{ overUnder: 300, odds: 140 }] },
                  draftkings: { odds: -115 },
                },
              },
            },
          },
        ],
      });
    };
    const monday = new Date('2026-10-05T15:00:00Z');
    const results = await Promise.all([
      scheduledApplicationOdds(s, monday, 'synthetic-key', fetcher),
      scheduledApplicationOdds(s, monday, 'synthetic-key', fetcher),
    ]);
    assert.equal(results.filter((r) => r.status === 'complete').length, 1);
    assert.equal(requests, 1);
    const [head] = await s.rows<any>('SELECT * FROM app_odds_publication'),
      manifest = await s.get<any>(head.object_hash),
      event = await s.get<any>(manifest.events[0].hash);
    assert.equal(head.coverage, 'PARTIAL');
    assert.equal(event.odds.passing.byBookmaker.fanduel.altLines[0].overUnder, 300);
    assert.equal(
      (
        await scheduledApplicationOdds(
          s,
          new Date('2026-10-06T15:00:00Z'),
          'synthetic-key',
          fetcher,
        )
      ).status,
      'outside-window',
    );
    used = 990;
    await assert.rejects(
      scheduledApplicationOdds(s, new Date('2026-10-07T15:00:00Z'), 'synthetic-key', fetcher),
    );
    assert.equal(requests, 1);
    assert.equal(
      (await s.rows<any>('SELECT object_hash FROM app_odds_publication'))[0].object_hash,
      head.object_hash,
    );
    used = 0;
    fail = true;
    await assert.rejects(
      scheduledApplicationOdds(s, new Date('2026-10-10T15:00:00Z'), 'synthetic-key', fetcher),
    );
    assert.equal(requests, 2);
    assert.equal(
      (
        await scheduledApplicationOdds(
          s,
          new Date('2026-10-10T15:01:00Z'),
          'synthetic-key',
          fetcher,
        )
      ).status,
      'already-attempted',
    );
    assert.equal(requests, 2);
    assert.equal(
      latestScheduledRefresh(new Date('2026-10-08T16:00:00Z')).toISOString(),
      '2026-10-07T15:00:00.000Z',
    );
    assert.equal(
      oddsFreshness(monday.toISOString(), 'PARTIAL', new Date('2026-10-08T16:00:00Z')).state,
      'STALE',
    );
    assert.equal(oddsFreshness(null).state, 'UNVERIFIED');
    // Durable budget is authoritative even if the provider's usage report lags.
    await s.batch([
      s.statement("UPDATE app_limits SET used=699 WHERE bucket='sports-objects:2026-10'"),
    ]);
    fail = false;
    await assert.rejects(
      scheduledApplicationOdds(s, new Date('2026-10-12T15:00:00Z'), 'synthetic-key', fetcher),
    );
    assert.equal(requests, 2);
  } finally {
    await h.close();
  }
});
