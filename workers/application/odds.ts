import { OddsSnapshotHistory } from '../../packages/storage/odds-snapshots';
import { Storage } from '../../packages/storage/core';
import {
  SportsGameOddsClient,
  type SportsGameOddsEvent,
} from '../../src/server/providers/sportsGameOdds';
import { EditorialDatabase } from '../content-engine/src/database';
import { runScheduledOdds } from '../content-engine/src/odds-schedule';
/** Durable account-wide reservations wrap the existing concrete provider client.
 * All provider bytes (including alt lines) are retained; no synthesized prices,
 * scores or sportsbook transfer links are introduced. */
export async function scheduledApplicationOdds(
  s: Storage,
  now: Date,
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey) throw Error('SportsGameOdds is not configured');
  let used: number | null = null,
    requests = 0;
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.sportsgameodds.com') throw Error('Unexpected provider origin');
    if (url.pathname.endsWith('/events')) {
      if (used === null || requests >= 2)
        throw Error('Missing verified provider usage or run request ceiling');
      const bound = Number(url.searchParams.get('limit')) + 1,
        bucket = `sports-objects:${now.toISOString().slice(0, 7)}`,
        nonce = crypto.randomUUID();
      if (!Number.isSafeInteger(bound) || bound < 2 || bound > 26)
        throw Error('Invalid bounded odds page');
      await s.batch([
        s.statement(
          'INSERT INTO app_limits(bucket,used) SELECT ?,? WHERE ?<=700 ON CONFLICT(bucket) DO UPDATE SET used=max(used,?)+? WHERE max(used,?)+?<=700',
          [bucket, used + bound, used + bound, used, bound, used, bound],
        ),
        s.guard(nonce),
        s.unguard(nonce),
      ]);
      requests++;
    }
    const response = await fetcher(input, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (url.pathname.endsWith('/account/usage') && response.ok) {
      const payload = (await response.clone().json()) as any;
      const monthly = payload.data?.rateLimits?.['per-month'],
        value = Number(monthly?.['current-entities'] ?? monthly?.currentEntities);
      if (!Number.isSafeInteger(value) || value < 0)
        throw Error('Provider monthly usage is unavailable');
      used = value;
    }
    return response;
  };
  return runScheduledOdds(new EditorialDatabase(s.db as unknown as D1Database), now, async () => {
    const client = new SportsGameOddsClient(apiKey, guarded),
      events = await client.getNflEvents({
        startsAfter: now.toISOString(),
        startsBefore: new Date(now.getTime() + 7 * 86400000).toISOString(),
        pageSize: 25,
      });
    if (!events.length) throw Error('Empty odds refresh; retain prior publication');
    if (new Set(events.map((e) => e.eventID)).size !== events.length)
      throw Error('Repeated provider event IDs');
    const objects: { id: string; hash: string; codec: string; historyId: string }[] = [],
      books = new Set<string>();
    for (const event of events) {
      for (const odd of Object.values(event.odds ?? {}))
        for (const book of Object.keys(odd.byBookmaker ?? {})) books.add(book);
      const history = await new OddsSnapshotHistory(s).write(
        event.eventID,
        now.toISOString(),
        event,
      );
      objects.push({
        id: event.eventID,
        hash: history.hash,
        codec: 'ODDS_TREE',
        historyId: history.id,
      });
    }
    const missing = ['fanduel', 'draftkings', 'betmgm', 'caesars'].filter((b) => !books.has(b)),
      coverage = missing.length ? 'PARTIAL' : 'COMPLETE',
      slot = now.toISOString().slice(0, 10),
      hash = await s.put({
        schema: 2,
        slot,
        provider: 'SPORTSGAMEODDS',
        events: objects,
        missingBooks: missing,
        completedAt: Date.now(),
      });
    await s.batch([
      s.statement(
        "INSERT INTO app_odds_publication(id,slot,object_hash,completed_at,coverage) VALUES('NFL',?,?,?,?) ON CONFLICT(id) DO UPDATE SET slot=excluded.slot,object_hash=excluded.object_hash,completed_at=excluded.completed_at,coverage=excluded.coverage",
        [slot, hash, Date.now(), coverage],
      ),
    ]);
    return {
      events: events.length,
      requests,
      coverage,
      missingBooks: missing,
      objectHash: hash,
      labScores: 'Existing calculations retained; D1 board/score publication adapter pending',
    };
  });
}
