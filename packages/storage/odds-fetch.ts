import { Storage } from './core';
import { guardedBatch } from './atomic';
import { oddsRefreshSlot } from '../../workers/content-engine/src/odds-schedule';
import { SportsGameOddsClient } from '../../src/server/providers/sportsGameOdds';
import { OddsSnapshotHistory } from './odds-snapshots';
export async function startOddsFetch(s: Storage, now: Date) {
  const slot = oddsRefreshSlot(now);
  if (!slot) return { status: 'outside-window' };
  const prior = await s.rows('SELECT slot FROM app_odds_fetch_runs WHERE slot=?', [slot]);
  if (prior.length) return { status: 'already-started', slot };
  await s
    .statement(
      "INSERT INTO app_odds_fetch_runs(slot,state,token,starts_at,ends_at) VALUES(?,'READY',?,?,?) ON CONFLICT DO NOTHING",
      [slot, crypto.randomUUID(), now.getTime(), now.getTime() + 7 * 86400000],
    )
    .run();
  return { status: 'started', slot };
}
/** Exactly one provider event page per invocation. UNCERTAIN is durable BEFORE
 * the first upstream call; a crash never silently retries an accepted request. */
export async function fetchOddsPage(
  s: Storage,
  options: {
    apiKey: string;
    verifiedDailyHttpCeiling: number;
    fetcher?: typeof fetch;
    now?: number;
  },
) {
  const now = options.now ?? Date.now(),
    [run] = await s.rows<any>(
      "SELECT * FROM app_odds_fetch_runs WHERE state='READY' ORDER BY slot LIMIT 1",
    );
  if (!run) return { status: 'idle' };
  const cap = options.verifiedDailyHttpCeiling;
  if (!options.apiKey || !Number.isSafeInteger(cap) || cap < 1 || cap > 100)
    throw Error('Verified free provider request ceiling and isolated credential required');
  const token = crypto.randomUUID(),
    [claimed] = await s.rows<any>(
      "UPDATE app_odds_fetch_runs SET state='UNCERTAIN',token=?,last_error='PROVIDER_ATTEMPT_NOT_ACKNOWLEDGED' WHERE slot=? AND state='READY' AND token=? RETURNING slot",
      [token, run.slot, run.token],
    );
  if (!claimed) return { status: 'busy' };
  let liveUsage: number | null = null;
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.sportsgameodds.com')
      throw Error('Unexpected odds provider origin');
    const bucket = 'odds-http:' + new Date(now).toISOString().slice(0, 10);
    const [reserved] = await s.rows<any>(
      'INSERT INTO app_limits(bucket,used) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<? RETURNING used',
      [bucket, cap],
    );
    if (!reserved) throw Error('Provider HTTP request ceiling reached');
    if (url.pathname.endsWith('/events')) {
      if (liveUsage === null) throw Error('Provider usage was not verified');
      const monthly = 'sports-objects:' + new Date(now).toISOString().slice(0, 7),
        bound = 2;
      const [safe] = await s.rows<any>(
        'INSERT INTO app_limits(bucket,used) SELECT ?,? WHERE ?<=700 ON CONFLICT(bucket) DO UPDATE SET used=max(used,?)+? WHERE max(used,?)+?<=700 RETURNING used',
        [monthly, liveUsage + bound, liveUsage + bound, liveUsage, bound, liveUsage, bound],
      );
      if (!safe) throw Error('Provider monthly object ceiling reached');
    }
    const response = await (options.fetcher ?? fetch)(input, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (url.pathname.endsWith('/account/usage') && response.ok) {
      const payload = (await response.clone().json()) as any,
        m = payload.data?.rateLimits?.['per-month'],
        usage = Number(m?.['current-entities'] ?? m?.currentEntities);
      if (!Number.isSafeInteger(usage) || usage < 0) throw Error('Provider usage unavailable');
      liveUsage = usage;
    }
    return response;
  };
  const page = await new SportsGameOddsClient(options.apiKey, guarded).getNflEventsPage({
    startsAfter: new Date(run.starts_at).toISOString(),
    startsBefore: new Date(run.ends_at).toISOString(),
    pageSize: 1,
    cursor: run.next_cursor ?? undefined,
  });
  if (!Array.isArray(page.data) || page.data.length > 1 || (!page.data.length && !run.pages))
    throw Error('Provider returned an invalid bounded page');
  const event = page.data[0],
    refs = await s.rows<{ reference_json: string }>(
      'SELECT reference_json FROM app_odds_processing WHERE slot=? ORDER BY event_id',
      [run.slot],
    );
  const references = refs.map((r) => JSON.parse(r.reference_json));
  let reference: any;
  const books = new Set<string>(JSON.parse(run.books_json));
  if (event) {
    if (references.some((r) => r.id === event.eventID))
      throw Error('Repeated provider event across pages');
    const history = await new OddsSnapshotHistory(s).write(
      event.eventID,
      new Date(now).toISOString(),
      event,
    );
    reference = {
      id: event.eventID,
      hash: history.hash,
      codec: 'ODDS_TREE',
      historyId: history.id,
    };
    references.push(reference);
    for (const odd of Object.values(event.odds ?? {}))
      for (const book of Object.keys(odd.byBookmaker ?? {})) books.add(book);
  }
  const writes = [];
  if (reference)
    writes.push(
      s.statement(
        "INSERT INTO app_odds_processing(slot,event_id,object_hash,reference_json,as_of,status) VALUES(?,?,?,?,?,'READY')",
        [run.slot, event!.eventID, reference.hash, JSON.stringify(reference), now],
      ),
    );
  const next = page.nextCursor ?? null;
  if (next !== null && (typeof next !== 'string' || next.length > 4096 || next === run.next_cursor))
    throw Error('Invalid provider continuation');
  if (!next) {
    const missing = ['fanduel', 'draftkings', 'betmgm', 'caesars'].filter(
        (book) => !books.has(book),
      ),
      coverage = missing.length ? 'PARTIAL' : 'COMPLETE';
    const hash = await s.put({
      schema: 2,
      slot: run.slot,
      provider: 'SPORTSGAMEODDS',
      events: references,
      missingBooks: missing,
      completedAt: now,
    });
    writes.push(
      s.statement(
        "INSERT INTO app_odds_publication(id,slot,object_hash,completed_at,coverage) VALUES('NFL',?,?,?,?) ON CONFLICT(id) DO UPDATE SET slot=excluded.slot,object_hash=excluded.object_hash,completed_at=excluded.completed_at,coverage=excluded.coverage",
        [run.slot, hash, now, coverage],
      ),
    );
  }
  writes.push(
    s.statement(
      "UPDATE app_odds_fetch_runs SET state=?,next_cursor=?,pages=pages+1,books_json=?,last_error=NULL WHERE slot=? AND token=? AND state='UNCERTAIN'",
      [next ? 'READY' : 'COMPLETE', next, JSON.stringify([...books]), run.slot, token],
    ),
  );
  await guardedBatch(
    s,
    [
      {
        sql: "EXISTS(SELECT 1 FROM app_odds_fetch_runs WHERE slot=? AND token=? AND state='UNCERTAIN')",
        values: [run.slot, token],
      },
    ],
    writes,
  );
  return { status: next ? 'continued' : 'complete', slot: run.slot, events: references.length };
}
