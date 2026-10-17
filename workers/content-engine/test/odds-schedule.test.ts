import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { EditorialDatabase } from '../src/database';
import { oddsRefreshSlot, runScheduledOdds } from '../src/odds-schedule';

test('exactly three UTC refresh windows per week including DST boundaries', () => {
  for (const start of ['2026-03-02', '2026-10-26', '2026-12-28']) {
    let windows = 0;
    for (let hour = 0; hour < 7 * 24; hour++) {
      const now = new Date(Date.parse(`${start}T00:00:00Z`) + hour * 3600000);
      if (oddsRefreshSlot(now)) windows++;
    }
    assert.equal(windows, 3);
  }
});
test('concurrent duplicate deliveries, restarts and ambiguous provider errors cannot spend twice', async () => {
  const h = await harness(true);
  try {
    const now = new Date('2026-10-19T15:00:00Z');
    let calls = 0;
    const refresh = async () => {
      calls++;
      return { events: 16, fixture: true };
    };
    const results = await Promise.all([
      runScheduledOdds(h.db, now, refresh),
      runScheduledOdds(h.db, now, refresh),
    ]);
    assert.equal(calls, 1);
    assert.equal(results.filter((r) => r.status === 'complete').length, 1);
    const db = new EditorialDatabase((await h.restart()) as unknown as D1Database);
    assert.equal((await runScheduledOdds(db, now, refresh)).status, 'already-attempted');
    const next = new Date('2026-10-21T15:00:00Z');
    await assert.rejects(
      runScheduledOdds(db, next, async () => {
        calls++;
        throw Error('Lost provider acknowledgement');
      }),
    );
    assert.equal((await runScheduledOdds(db, next, refresh)).status, 'already-attempted');
    assert.equal(calls, 2);
    assert.equal(
      (await runScheduledOdds(db, new Date('2026-10-22T15:00:00Z'), refresh)).status,
      'outside-window',
    );
  } finally {
    await h.close();
  }
});
