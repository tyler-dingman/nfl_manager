import { digest, utf8, type SqlDatabase } from './core';
import { decodeObject } from './codec';
import roleSchemas from './multi-d1-schema-hashes.json';
import { GC_ROOT_SCHEMA_HASH } from './gc-schema';
export const RETENTION_DAYS = {
  published: 90,
  drafts: 7,
  candidates: 7,
  briefings: 30,
  odds: 30,
  ai: 1,
} as const;
const day = 86400000;
const q = (name: string) => '"' + name.replaceAll('"', '""') + '"';
export type FrozenTable = { name: string; sql: string; rows: Record<string, any>[] };
export type ArchiveReceipt = { digest: string; path: string; snapshotDigest: string };
type Operation = { sql: string; values: unknown[] };
type Cluster = {
  kind: string;
  id: string;
  rows: Set<Record<string, any>>;
  operations: Operation[];
  hashes: Set<string>;
  referenceIds: Set<string>;
};
export async function snapshotDigest(tables: FrozenTable[]) {
  return digest(
    utf8.encode(
      JSON.stringify(
        tables.map((t) => ({
          ...t,
          rows: [...t.rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        })),
      ),
    ),
  );
}
/** Owner-side full scan only. SDK writers must already be fenced and raw writers
 * stopped. FTS rowids are included so archive restore preserves indexed links. */
export async function frozenTables(
  db: SqlDatabase,
  role?: keyof typeof roleSchemas,
): Promise<FrozenTable[]> {
  const names = await db
    .prepare(
      "SELECT s.name,s.sql FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name AND p.schema='main' WHERE s.type='table' AND p.type IN('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' ORDER BY s.name",
    )
    .all<{ name: string; sql: string }>();
  if (!names.success) throw Error('Snapshot schema failed');
  const tables: FrozenTable[] = [];
  for (const t of names.results) {
    const rows: any[] = [];
    const info = await db.prepare(`PRAGMA table_info(${q(t.name)})`).all<any>();
    if (!info.success || info.results.some((c) => c.name === '_dd_scan_cursor'))
      throw Error('Snapshot cursor schema conflict');
    const without = /\bWITHOUT\s+ROWID\b/i.test(t.sql),
      keys = without
        ? info.results
            .filter((c) => c.pk)
            .sort((a, b) => a.pk - b.pk)
            .map((c) => c.name)
        : [];
    if (without && !keys.length) throw Error('Snapshot primary key required');
    let cursor: unknown[] | undefined;
    for (;;) {
      const order = without ? keys.map(q).join(',') : 'rowid';
      const predicate = cursor
        ? without
          ? `WHERE (${order})>(${keys.map(() => '?').join(',')})`
          : 'WHERE rowid>?'
        : '';
      const selection = without
        ? '*'
        : `CAST(rowid AS TEXT) AS _dd_scan_cursor,${/\bfts5\b/i.test(t.sql) ? 'rowid,' : ''}*`;
      const r = await db
        .prepare(`SELECT ${selection} FROM ${q(t.name)} ${predicate} ORDER BY ${order} LIMIT 100`)
        .bind(...(cursor ?? []))
        .all();
      if (!r.success) throw Error('Snapshot read failed');
      const last = r.results.at(-1) as any;
      if (last) cursor = without ? keys.map((k) => last[k]) : [last._dd_scan_cursor];
      for (const row of r.results) {
        delete (row as any)._dd_scan_cursor;
        rows.push(
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              value instanceof ArrayBuffer ? Array.from(new Uint8Array(value)) : value,
            ]),
          ),
        );
      }
      if (r.results.length < 100) break;
    }
    tables.push({ ...t, rows });
  }
  const logical = tables
    .filter((t) => !t.name.startsWith('app_storage_') && !t.name.startsWith('app_payload_'))
    .map(({ name, sql }) => ({ name, sql }));
  if (
    (await digest(utf8.encode(JSON.stringify(logical)))) !==
    (role ? roleSchemas[role] : GC_ROOT_SCHEMA_HASH)
  )
    throw Error('Unknown root schema: retention review required');
  return tables;
}
const strings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return [value, ...strings(parsed)];
    } catch {}
    return [value];
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};
const hashes = (value: unknown) =>
  new Set(
    strings(value).flatMap((text) => [...text.matchAll(/\b[a-f0-9]{64}\b/g)].map((m) => m[0])),
  );
/** Builds the immutable payload graph from the frozen snapshot. Every complete
 * object is authenticated, even orphans; opaque/corrupt data fails closed. */
async function payloadGraph(tables: FrozenTable[]) {
  const objects = tables.find((t) => t.name === 'app_payload_objects')!.rows;
  const chunks = tables.find((t) => t.name === 'app_payload_chunks')!.rows;
  const graph = new Map<string, { value: any; edges: Set<string> }>();
  const mailRoots = new Set(
    (tables.find((t) => t.name === 'app_mail')?.rows ?? []).map((r) => r.object_hash),
  );
  for (const r of tables.find((t) => t.name === 'app_storage_erased_mail')?.rows ?? [])
    mailRoots.add(r.hash);
  for (const head of objects) {
    if (!head.complete) continue;
    let stored: Uint8Array;
    if (head.inline_data != null) {
      if (head.chunks !== 0) throw Error('Invalid inline object');
      stored = new Uint8Array(head.inline_data);
    } else {
      const parts = chunks
        .filter((c) => c.hash === head.hash)
        .sort((a, b) => a.ordinal - b.ordinal);
      if (parts.length !== head.chunks) throw Error('Incomplete object');
      stored = new Uint8Array(head.bytes);
      let at = 0;
      for (const [i, row] of parts.entries()) {
        if (row.ordinal !== i) throw Error('Invalid chunk order');
        const bytes =
          row.data == null
            ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
            : new Uint8Array(row.data);
        stored.set(bytes, at);
        at += bytes.length;
      }
      if (at !== head.bytes) throw Error('Invalid object length');
    }
    if (stored.length !== head.bytes) throw Error('Invalid object length');
    const decoded = await decodeObject(stored, head.hash);
    let value: any;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
    } catch {
      throw Error('Opaque recovery payload requires owner review before retention');
    }
    if (value?.cipher && value?.iv && !mailRoots.has(head.hash))
      throw Error('Opaque encrypted recovery payload requires decoded inventory');
    const check = (v: any, key = '') => {
      if (
        typeof v === 'string' &&
        ['root', 'referenceHash', 'bodyHash'].includes(key) &&
        /^[a-f0-9]{64}$/.test(v) &&
        !objects.some((o) => o.hash === v && o.complete)
      )
        throw Error('Missing nested immutable reference');
      if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) check(child, k);
    };
    check(value);
    graph.set(head.hash, { value, edges: hashes(value) });
  }
  for (const table of tables)
    if (
      !table.name.startsWith('app_payload_') &&
      !table.name.startsWith('app_storage_') &&
      table.name !== 'app_cross_shard_references'
    )
      for (const row of table.rows)
        for (const key of [
          'object_hash',
          'metadata_hash',
          'markets_hash',
          'market_ids_hash',
          'board_hash',
        ])
          if (row[key] != null && (!/^[a-f0-9]{64}$/.test(row[key]) || !graph.has(row[key])))
            throw Error('Missing durable payload reference');
  return graph;
}
/** Pure planning on a frozen, archived snapshot. Unknown external references
 * over-retain. Fixed-point marking preserves transitive/cross-article references. */
export async function planApprovedRetention(tables: FrozenTable[], now: number, limit = 100) {
  if (!Number.isSafeInteger(now) || !Number.isInteger(limit) || limit < 1 || limit > 500)
    throw Error('Invalid retention plan bound');
  const graph = await payloadGraph(tables),
    byName = new Map(tables.map((t) => [t.name, t.rows]));
  const rows = (name: string) => byName.get(name) ?? [];
  const clusters: Cluster[] = [];
  const make = (kind: string, id: string) => ({
    kind,
    id,
    rows: new Set<any>(),
    operations: [] as Operation[],
    hashes: new Set<string>(),
    referenceIds: new Set([id]),
  });
  const own = (
    c: Cluster,
    table: string,
    predicate: (row: any) => boolean,
    sql: string,
    values: unknown[],
    hashFields?: string[],
  ) => {
    const found = rows(table).filter(predicate);
    for (const r of found) {
      c.rows.add(r);
      for (const hash of hashes(hashFields ? hashFields.map((k) => r[k]) : r))
        if (graph.has(hash)) c.hashes.add(hash);
    }
    if (found.length) c.operations.push({ sql, values });
  };
  const ids = new Set(
    [...rows('app_public_stories'), ...rows('app_editorial_stories')].map((r) => r.id),
  );
  for (const id of ids) {
    const pub = rows('app_public_stories').find((r) => r.id === id),
      canonical = rows('app_editorial_stories').find((r) => r.id === id);
    const versions = rows('app_public_story_versions').filter((r) => r.id === id);
    const wasPublished =
      Boolean(pub?.visible) ||
      ['PUBLISHED', 'AUTO_PUBLISHED'].includes(canonical?.publication_state) ||
      rows('app_editorial_versions').some(
        (r) =>
          r.story_id === id &&
          ['PUBLISHED', 'AUTO_PUBLISHED'].includes(
            graph.get(r.object_hash)?.value?.story?.publicationState,
          ),
      ) ||
      versions.some((r) =>
        ['PUBLISHED', 'AUTO_PUBLISHED'].includes(graph.get(r.object_hash)?.value?.state),
      );
    const updated = Math.max(
      pub?.updated_at ?? 0,
      canonical?.updated_at ?? 0,
      canonical?.last_meaningful_update_at ?? 0,
      ...rows('app_editorial_versions')
        .filter((r) => r.story_id === id)
        .map((r) => Number(r.created_at) || 0),
      ...versions.map(
        (r) => Date.parse(graph.get(r.object_hash)?.value?.story?.lastMeaningfulUpdateAt) || 0,
      ),
    );
    if (!updated || updated > now - (wasPublished ? 90 : 7) * day) continue;
    const c = make(wasPublished ? 'ARTICLE' : 'DRAFT', id);
    for (const [table, key] of [
      ['app_search', 'id'],
      ['app_public_wire', 'story_id'],
      ['app_public_story_versions', 'id'],
      ['app_public_stories', 'id'],
      ['app_editorial_decisions', 'story_id'],
      ['app_editorial_events', 'story_id'],
      ['app_story_overrides', 'story_id'],
      ['app_editorial_versions', 'story_id'],
      ['app_editorial_evidence', 'story_id'],
      ['app_editorial_stories', 'id'],
    ])
      own(c, table, (r) => r[key] === id, `DELETE FROM ${q(table)} WHERE ${q(key)}=?`, [id]);
    for (const row of c.rows) if (typeof row.id === 'string') c.referenceIds.add(row.id);
    clusters.push(c);
  }
  for (const candidate of rows('app_editorial_candidates')) {
    const jobs = rows('app_editorial_jobs').filter((r) => {
      try {
        return JSON.parse(r.payload).candidateId === candidate.id;
      } catch {
        return false;
      }
    });
    if (
      !['CLUSTERED', 'PROCESSED', 'REJECTED'].includes(candidate.status) ||
      !jobs.length ||
      jobs.some((r) => r.status !== 'COMPLETED' || r.updated_at > now - 7 * day)
    )
      continue;
    const c = make('CANDIDATE', candidate.id);
    for (const job of jobs) {
      c.rows.add(job);
      c.operations.push({
        sql: "UPDATE app_editorial_jobs SET payload='{}',last_error=NULL WHERE id=? AND status='COMPLETED'",
        values: [job.id],
      });
    }
    c.operations.push({
      sql: 'INSERT INTO app_storage_candidate_receipts(id,source_id,external_id,canonical_url,fingerprint) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',
      values: [
        candidate.id,
        candidate.source_id,
        candidate.external_id,
        candidate.canonical_url,
        candidate.fingerprint,
      ],
    });
    own(
      c,
      'app_editorial_candidates',
      (r) => r.id === candidate.id,
      'DELETE FROM app_editorial_candidates WHERE id=?',
      [candidate.id],
    );
    clusters.push(c);
  }
  for (const briefing of rows('app_daily_briefings')) {
    if (briefing.published_at > now - 30 * day) continue;
    const jobs = rows('app_briefing_mail_jobs').filter((r) => r.id === briefing.id);
    if (jobs.some((r) => r.status !== 'DONE' || r.lease_until > now)) continue;
    const c = make('BRIEFING', briefing.id);
    own(
      c,
      'app_briefing_mail_jobs',
      (r) => r.id === briefing.id,
      'DELETE FROM app_briefing_mail_jobs WHERE id=?',
      [briefing.id],
    );
    own(
      c,
      'app_daily_briefings',
      (r) => r.id === briefing.id,
      'DELETE FROM app_daily_briefings WHERE id=?',
      [briefing.id],
    );
    clusters.push(c);
  }
  for (const history of rows('app_odds_board_history')) {
    if (history.as_of > now - 30 * day) continue;
    const c = make('ODDS_HISTORY', history.event_id + ':' + history.as_of);
    c.referenceIds = new Set();
    own(
      c,
      'app_odds_board_history',
      (r) => r === history,
      'DELETE FROM app_odds_board_history WHERE event_id=? AND as_of=?',
      [history.event_id, history.as_of],
    );
    clusters.push(c);
  }
  for (const history of rows('app_odds_history')) {
    if (Date.parse(history.as_of) > now - 30 * day || !Number.isFinite(Date.parse(history.as_of)))
      continue;
    const c = make('ODDS_RAW', history.id);
    own(c, 'app_odds_history', (r) => r === history, 'DELETE FROM app_odds_history WHERE id=?', [
      history.id,
    ]);
    clusters.push(c);
  }
  for (const event of rows('app_sportsbook_events')) {
    if (!event.markets_hash || event.kickoff_at > now - 30 * day || event.as_of > now - 30 * day)
      continue;
    const c = make('ODDS_HEAD', event.id);
    c.referenceIds = new Set();
    own(
      c,
      'app_sportsbook_events',
      (r) => r === event,
      'UPDATE app_sportsbook_events SET markets_hash=NULL,version=version+1 WHERE id=?',
      [event.id],
      ['markets_hash'],
    );
    own(
      c,
      'app_parlay_scores',
      (r) => r.event_id === event.id,
      'DELETE FROM app_parlay_scores WHERE event_id=?',
      [event.id],
    );
    clusters.push(c);
  }
  // Completed operational roots retain compact identity receipts, not old raw
  // provider bodies. Active publications, uncertain work and incomplete fetch
  // runs remain roots. The same archive/audit/atomic cursor as editorial cleanup
  // owns these transitions; no HTTP handler performs cross-shard deletion.
  for (const task of rows('app_odds_processing')) {
    if (
      !['DONE', 'SUPERSEDED'].includes(task.status) ||
      task.as_of > now - 30 * day ||
      task.lease_until > now ||
      rows('app_odds_publication').some((r) => r.slot === task.slot) ||
      !rows('app_odds_fetch_runs').some((r) => r.slot === task.slot && r.state === 'COMPLETE')
    )
      continue;
    if (graph.get(task.object_hash)?.value?.kind === 'ODDS_PROCESSING_RECEIPT') continue;
    const c = make('PROCESSING_RECEIPT', task.slot + ':' + task.event_id);
    c.referenceIds = new Set();
    c.rows.add(task);
    for (const h of hashes(task)) if (graph.has(h)) c.hashes.add(h);
    const text = JSON.stringify({
      schema: 1,
      kind: 'ODDS_PROCESSING_RECEIPT',
      provider: 'SPORTSGAMEODDS',
      slot: task.slot,
      eventId: task.event_id,
      asOf: task.as_of,
      status: task.status,
      canonicalEventId: task.canonical_event_id,
    });
    const hash = await digest(utf8.encode(text));
    const guard = crypto.randomUUID();
    c.operations.push(
      { sql: 'INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)', values: [] },
      {
        sql: 'INSERT INTO app_payload_objects(hash,bytes,chunks,complete,inline_data) SELECT ?,?,0,1,CAST(? AS BLOB) WHERE (SELECT used_bytes FROM app_payload_capacity WHERE id=1)+?<=64000000 ON CONFLICT DO NOTHING',
        values: [hash, utf8.encode(text).length, text, utf8.encode(text).length],
      },
      {
        sql: 'UPDATE app_payload_capacity SET used_bytes=used_bytes+? WHERE id=1 AND changes()=1',
        values: [utf8.encode(text).length],
      },
      {
        sql: 'INSERT INTO app_storage_guards(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM app_payload_objects WHERE hash=? AND complete=1) THEN 1 ELSE 0 END',
        values: [guard, hash],
      },
      {
        sql: "UPDATE app_odds_processing SET object_hash=?,reference_json=?,lease_nonce=NULL,last_error=NULL WHERE slot=? AND event_id=? AND status IN('DONE','SUPERSEDED')",
        values: [
          hash,
          JSON.stringify({ id: task.event_id, archived: true }),
          task.slot,
          task.event_id,
        ],
      },
      { sql: 'DELETE FROM app_storage_guards WHERE id=?', values: [guard] },
    );
    clusters.push(c);
  }
  // Any permanent/non-odds root mentioning an event or market conservatively
  // preserves that event's historical boards. A timestamp is not guessed.
  const compactedRows = new Set(
    clusters.filter((c) => c.kind === 'PROCESSING_RECEIPT').flatMap((c) => [...c.rows]),
  );
  const permanentStrings: string[] = [];
  const permanentSeen = new Set<string>(),
    permanentQueue: string[] = [];
  const oddsTables = new Set([
    'app_sportsbook_events',
    'app_odds_board_history',
    'app_odds_history',
    'app_parlay_scores',
  ]);
  for (const table of tables)
    if (
      !oddsTables.has(table.name) &&
      !table.name.startsWith('app_payload_') &&
      !table.name.startsWith('app_storage_')
    )
      for (const row of table.rows) {
        if (compactedRows.has(row)) continue;
        permanentStrings.push(...strings(row));
        for (const h of hashes(row)) if (graph.has(h)) permanentQueue.push(h);
      }
  for (const pin of rows('app_storage_pins'))
    if (graph.has(pin.hash)) permanentQueue.push(pin.hash);
  while (permanentQueue.length) {
    const h = permanentQueue.pop()!;
    if (permanentSeen.has(h)) continue;
    permanentSeen.add(h);
    const node = graph.get(h)!;
    permanentStrings.push(...strings(node.value));
    for (const child of node.edges) if (graph.has(child)) permanentQueue.push(child);
  }
  for (const c of clusters.filter((c) => c.kind.startsWith('ODDS'))) {
    const eventId =
      c.kind === 'ODDS_HISTORY'
        ? c.id.slice(0, c.id.lastIndexOf(':'))
        : c.kind === 'ODDS_HEAD'
          ? c.id
          : rows('app_odds_history').find((r) => r.id === c.id)?.provider_event_id;
    if (eventId && permanentStrings.some((text) => text.includes(eventId)))
      c.referenceIds.add('__PERMANENT_SAVED_MARKET__');
    const seen = new Set<string>(),
      queue = [...c.hashes],
      identities = new Set<string>();
    const inspect = (value: any) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value) && value[0] === 'o' && Array.isArray(value[1]))
        for (const [key, child] of value[1])
          if (['id', 'marketId', 'market_id'].includes(key)) {
            const literal = graph.get(child)?.value;
            if (literal?.[0] === 'v' && typeof literal[1] === 'string') identities.add(literal[1]);
          }
      if (!Array.isArray(value))
        for (const key of ['id', 'marketId', 'market_id'])
          if (typeof value[key] === 'string') identities.add(value[key]);
      for (const child of Object.values(value)) inspect(child);
    };
    while (queue.length) {
      const hash = queue.pop()!;
      if (seen.has(hash)) continue;
      seen.add(hash);
      const node = graph.get(hash);
      if (!node) continue;
      inspect(node.value);
      for (const child of node.edges) if (graph.has(child)) queue.push(child);
    }
    if ([...identities].some((id) => permanentStrings.some((text) => text.includes(id))))
      c.referenceIds.add('__PERMANENT_SAVED_MARKET__');
  }

  const available = clusters.filter((c) => c.operations.length <= 20 && c.rows.size <= 500);
  let selected = new Set(available);
  const protectSelection = () => {
    let changed = true;
    while (changed) {
      changed = false;
      const excluded = new Set([...selected].flatMap((c) => [...c.rows]));
      const reachable = new Set<string>(),
        queue: string[] = [],
        texts: string[] = [];
      for (const table of tables) {
        if (table.name.startsWith('app_payload_') || table.name.startsWith('app_storage_'))
          continue;
        for (const row of table.rows)
          if (!excluded.has(row)) {
            texts.push(...strings(row));
            for (const hash of hashes(row)) if (graph.has(hash)) queue.push(hash);
          }
      }
      for (const pin of rows('app_storage_pins')) {
        if (!graph.has(pin.hash)) throw Error('Missing recovery pin');
        queue.push(pin.hash);
      }
      while (queue.length) {
        const hash = queue.pop()!;
        if (reachable.has(hash)) continue;
        reachable.add(hash);
        const node = graph.get(hash);
        if (!node) throw Error('Missing retained payload reference');
        texts.push(...strings(node.value));
        for (const edge of node.edges) if (graph.has(edge)) queue.push(edge);
      }
      for (const c of selected) {
        const direct = [...c.referenceIds].some(
          (id) => id === '__PERMANENT_SAVED_MARKET__' || texts.some((text) => text.includes(id)),
        );
        if (direct || [...c.hashes].some((h) => reachable.has(h))) {
          selected.delete(c);
          changed = true;
        }
      }
    }
  };
  protectSelection();
  const protectedCount = clusters.length - selected.size;
  selected = new Set([...selected].slice(0, limit));
  protectSelection();
  return {
    items: [...selected],
    candidates: clusters.length,
    protected: protectedCount,
    oversized: clusters.length - available.length,
  };
}
/** Claim and preparation intent are atomic: a process crash cannot leave an
 * anonymous fence. PREPARING is abortable because no application rows changed. */
export async function beginRetentionPreparation(db: SqlDatabase, path: string) {
  if (!path) throw Error('Archive path required');
  await db.prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)').run();
  const id = crypto.randomUUID(),
    token = crypto.randomUUID();
  const result = await db.batch([
    db.prepare('UPDATE app_storage_epoch SET epoch=epoch+1,locked=1 WHERE id=1 AND locked=0'),
    db.prepare('INSERT INTO app_storage_guards(id,ok) VALUES(?,changes())').bind(token),
    db
      .prepare(
        "INSERT INTO app_storage_retention_plans(id,epoch,state,archive_digest,archive_path,created_at) SELECT ?,epoch,'PREPARING','PENDING',?,? FROM app_storage_epoch WHERE id=1",
      )
      .bind(id, path, Date.now()),
    db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token),
  ]);
  if (result.some((r) => !r.success)) throw Error('Maintenance claim failed');
  return id;
}
/** Archive verification happens in the owner CLI. Snapshot digest is checked
 * again before publishing a plan; no network/authenticated HTTP route exists. */
export async function publishRetentionPlan(
  db: SqlDatabase,
  tables: FrozenTable[],
  receipt: ArchiveReceipt,
  now: number,
  limit = 100,
  preparationId?: string,
  role?: keyof typeof roleSchemas,
) {
  if (
    !/^[a-f0-9]{64}$/.test(receipt.digest) ||
    !receipt.path ||
    receipt.snapshotDigest !== (await snapshotDigest(tables))
  )
    throw Error('Verified archive receipt required');
  const epoch = await db
    .prepare('SELECT epoch,locked FROM app_storage_epoch WHERE id=1')
    .first<{ epoch: number; locked: number }>();
  if (!epoch?.locked) throw Error('Owner write fence required');
  if ((await snapshotDigest(await frozenTables(db, role))) !== receipt.snapshotDigest)
    throw Error('Frozen snapshot changed; archive again');
  const planned = await planApprovedRetention(tables, now, limit),
    id = preparationId ?? crypto.randomUUID();
  const items = planned.items;
  if (preparationId) {
    const updated = await db
      .prepare(
        "UPDATE app_storage_retention_plans SET archive_digest=?,archive_path=? WHERE id=? AND epoch=? AND state='PREPARING' AND archive_digest='PENDING'",
      )
      .bind(receipt.digest, receipt.path, id, epoch.epoch)
      .run();
    if (updated.meta.changes !== 1) throw Error('Preparation intent mismatch');
  } else {
    await db
      .prepare(
        "INSERT INTO app_storage_retention_plans(id,epoch,state,archive_digest,archive_path,created_at) VALUES(?,?,'PREPARING',?,?,?)",
      )
      .bind(id, epoch.epoch, receipt.digest, receipt.path, now)
      .run();
  }
  // Owner preparation is unbounded, but SQL batch size remains <=48.
  for (let i = 0; i < items.length; i += 20) {
    const result = await db.batch(
      items
        .slice(i, i + 20)
        .map((c, j) =>
          db
            .prepare(
              'INSERT INTO app_storage_retention_items(run_id,ordinal,kind,original_id,operations_json) VALUES(?,?,?,?,?)',
            )
            .bind(id, i + j + 1, c.kind, c.id, JSON.stringify(c.operations)),
        ),
    );
    if (result.some((r) => !r.success))
      throw Error('Plan publication failed; keep owner fence held');
  }
  await db
    .prepare(
      "UPDATE app_storage_retention_plans SET state='RUNNING' WHERE id=? AND state='PREPARING'",
    )
    .bind(id)
    .run();
  return {
    runId: id,
    planned: items.length,
    candidates: planned.candidates,
    protected: planned.protected,
    oversized: planned.oversized,
  };
}
export async function retentionStep(
  db: SqlDatabase,
  runId: string,
  authorization: 'OWNER_PRIVATE_MAINTENANCE',
  retainFence = false,
) {
  if (authorization !== 'OWNER_PRIVATE_MAINTENANCE')
    throw Error('Private owner authorization required');
  const plan = await db
    .prepare('SELECT * FROM app_storage_retention_plans WHERE id=?')
    .bind(runId)
    .first<any>();
  if (!plan) throw Error('Unknown plan');
  if (plan.state === 'DONE') return { done: true, retired: 0 };
  if (plan.state !== 'RUNNING') throw Error('Plan preparation incomplete; owner abort required');
  const item = await db
    .prepare(
      'SELECT * FROM app_storage_retention_items WHERE run_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
    )
    .bind(runId, plan.last_ordinal)
    .first<any>();
  const token = crypto.randomUUID(),
    ops: Operation[] = item ? JSON.parse(item.operations_json) : [];
  if (ops.length > 20) throw Error('Retention step exceeds bound');
  const batch = [
    db
      .prepare(
        "INSERT INTO app_storage_guards(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM app_storage_epoch e JOIN app_storage_retention_plans p ON e.epoch=p.epoch WHERE e.id=1 AND e.locked=1 AND p.id=? AND p.state='RUNNING' AND p.last_ordinal=?) THEN 1 ELSE 0 END)",
      )
      .bind(token, runId, plan.last_ordinal),
    ...ops.map((op) => db.prepare(op.sql).bind(...op.values)),
  ];
  if (item)
    batch.push(
      db
        .prepare(
          'INSERT INTO app_storage_retention_audit(run_id,ordinal,kind,original_id,archive_digest,retired_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(runId, item.ordinal, item.kind, item.original_id, plan.archive_digest, Date.now()),
      db
        .prepare('UPDATE app_storage_retention_plans SET last_ordinal=? WHERE id=?')
        .bind(item.ordinal, runId),
      db
        .prepare('DELETE FROM app_storage_retention_items WHERE run_id=? AND ordinal=?')
        .bind(runId, item.ordinal),
    );
  else
    batch.push(
      db.prepare("UPDATE app_storage_retention_plans SET state='DONE' WHERE id=?").bind(runId),
      ...(retainFence ? [] : [db.prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1')]),
    );
  batch.push(db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(token));
  try {
    const result = await db.batch(batch);
    if (result.some((r) => !r.success)) throw Error('Retention transaction failed');
    return { done: !item, retired: item ? 1 : 0 };
  } catch (error) {
    const current = await db
      .prepare('SELECT last_ordinal,state FROM app_storage_retention_plans WHERE id=?')
      .bind(runId)
      .first<any>();
    if (current && (current.state === 'DONE' || current.last_ordinal !== plan.last_ordinal))
      return { done: current.state === 'DONE', retired: 0, retry: true };
    throw error;
  }
}
