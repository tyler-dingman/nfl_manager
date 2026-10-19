import roleSchemas from './multi-d1-schema-hashes.json';
import { GC_ROOT_SCHEMA_HASH } from './gc-schema';
import { digest, utf8, decode, type SqlDatabase } from './core';
import { decodeObject } from './codec';
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const hashes = (value: unknown): string[] =>
  typeof value === 'string' ? [...value.matchAll(/\b[a-f0-9]{64}\b/g)].map((m) => m[0]) : [];
const internal = (name: string) =>
  name.startsWith('app_payload_') || name.startsWith('app_storage_');
export type CollectorReport = {
  runId: string;
  dryRun: boolean;
  rootReferences: number;
  reachable: number;
  objects: number;
  candidateObjects: number;
  candidateEncodedBytes: number;
  deletedObjects: number;
  releasedEncodedBytes: number;
  queries: number;
  rowsRead: number;
  rowsWritten: number;
  physicalBytesReclaimed: null;
};
/** Owner-operated maintenance only, NOT a scheduled HTTP Worker handler.
 * The persistent fence pauses SDK writers for the whole mark/sweep. Every
 * application write uses the captured epoch, including writes after an upload.
 * Stop raw SQL/imports first. Crash leaves the fence locked, never lease-expired.
 * Each object is swept in a four-statement transaction; the full graph is reverified
 * each run. SQL/JSON references over-retain unknown hash strings deliberately. */
export async function collectPayloadGarbage(
  raw: SqlDatabase,
  options: {
    dryRun?: boolean;
    limit?: number;
    acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED';
    expireDerived?: boolean;
    prepareOnly?: boolean;
    role?: keyof typeof roleSchemas;
    coordinatedEpoch?: number;
  },
): Promise<CollectorReport> {
  if (options.acknowledge !== 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED')
    throw Error('Raw writers must be stopped');
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw Error('GC bounded run requires 1–500 objects');
  const report: CollectorReport = {
    runId: crypto.randomUUID(),
    dryRun: options.dryRun !== false,
    rootReferences: 0,
    reachable: 0,
    objects: 0,
    candidateObjects: 0,
    candidateEncodedBytes: 0,
    deletedObjects: 0,
    releasedEncodedBytes: 0,
    queries: 0,
    rowsRead: 0,
    rowsWritten: 0,
    physicalBytesReclaimed: null,
  };
  async function all<T = Record<string, unknown>>(sql: string, values: unknown[] = []) {
    report.queries++;
    const r = await raw
      .prepare(sql)
      .bind(...values)
      .all<T>();
    if (!r.success) throw Error('GC read failed');
    report.rowsRead += r.meta.rows_read ?? 0;
    return r.results;
  }
  async function run(sql: string, values: unknown[] = []) {
    report.queries++;
    const r = await raw
      .prepare(sql)
      .bind(...values)
      .run();
    if (!r.success) throw Error('GC write failed');
    report.rowsWritten += r.meta.rows_written ?? 0;
    report.rowsRead += r.meta.rows_read ?? 0;
    return r;
  }
  await run('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)');
  if (options.coordinatedEpoch !== undefined) {
    if (!options.role) throw Error('Coordinated GC requires reviewed role');
    const [epoch] = await all<{ epoch: number; locked: number }>(
      'SELECT epoch,locked FROM app_storage_epoch WHERE id=1',
    );
    if (epoch?.epoch !== options.coordinatedEpoch || epoch.locked !== 1)
      throw Error('Global maintenance fence mismatch');
  } else {
    const lock = await run(
      'UPDATE app_storage_epoch SET epoch=epoch+1,locked=1 WHERE id=1 AND locked=0',
    );
    if (lock.meta.changes !== 1)
      throw Error('Storage maintenance is already locked; owner recovery required');
  }
  let holdFence = false;
  try {
    const objects: {
      hash: string;
      bytes: number;
      chunks: number;
      complete: number;
      inline_data: number[] | ArrayBuffer | null;
    }[] = [];
    let lastHash = '';
    for (;;) {
      const part = await all<{
        hash: string;
        bytes: number;
        chunks: number;
        complete: number;
        inline_data: number[] | ArrayBuffer | null;
      }>(
        'SELECT hash,bytes,chunks,complete,inline_data FROM app_payload_objects WHERE hash>? ORDER BY hash LIMIT 100',
        [lastHash],
      );
      objects.push(...part);
      if (part.length < 100) break;
      lastHash = part.at(-1)!.hash;
    }
    const [capacity] = await all<{ used_bytes: number }>(
      'SELECT used_bytes FROM app_payload_capacity WHERE id=1',
    );
    if ((capacity?.used_bytes ?? 0) !== objects.reduce((sum, o) => sum + o.bytes, 0))
      throw Error('Capacity counter mismatch; reconcile offline');
    report.objects = objects.length;
    const inventory = new Map(objects.map((o) => [o.hash, o])),
      roots = new Set<string>(),
      mailRoots = new Set<string>(),
      edges = new Map<string, Set<string>>();
    const tables = await all<{ name: string; sql: string; without_rowid: number }>(
      "SELECT s.name,s.sql,p.wr AS without_rowid FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name AND p.schema='main' WHERE s.type='table' AND p.type IN ('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' ORDER BY s.name",
    );
    const rootSchema = tables
      .filter((t) => !internal(t.name))
      .map((t) => ({ name: t.name, sql: t.sql }));
    if (
      (await digest(utf8.encode(JSON.stringify(rootSchema)))) !==
      (options.role ? roleSchemas[options.role] : GC_ROOT_SCHEMA_HASH)
    )
      throw Error('Unknown root schema: review reference contracts before garbage collection');
    // Only expired inference rows with no active generator are eligible. This
    // is their already enforced cache expiry, not an invented editorial TTL.
    const now = Date.now();
    const expiredKeys = new Set(
      options.expireDerived
        ? (
            await all<{ cache_key: string }>(
              'SELECT cache_key FROM app_ai_cache WHERE expires_at<=? AND lease_until<? ORDER BY cache_key LIMIT 500',
              [now, now],
            )
          ).map((r) => r.cache_key)
        : [],
    );
    for (const { name, without_rowid } of tables) {
      if (internal(name) || name === 'app_cross_shard_references') continue;
      const keys = without_rowid
        ? (await all<{ name: string; pk: number }>(`PRAGMA table_info(${quote(name)})`))
            .filter((c) => c.pk)
            .sort((a, b) => a.pk - b.pk)
            .map((c) => c.name)
        : ['rowid'];
      if (!keys.length) throw Error('No safe keyset for GC root scan');
      let cursor: unknown[] | undefined;
      for (;;) {
        const expressions = keys.map(quote).join(',');
        const predicate = cursor
          ? ` WHERE (${expressions}) > (${keys.map(() => '?').join(',')})`
          : '';
        const rows = await all(
          `SELECT ${without_rowid ? '' : 'rowid AS _gc_cursor_,'}* FROM ${quote(name)}${predicate} ORDER BY ${expressions} LIMIT 100`,
          cursor ?? [],
        );
        for (const row of rows.filter(
          (r) => name !== 'app_ai_cache' || !expiredKeys.has(String(r.cache_key)),
        ))
          for (const [column, value] of Object.entries(row)) {
            if (value !== null && typeof value === 'object')
              throw Error('Unknown opaque SQL value; reference inventory required');
            if (
              [
                'object_hash',
                'metadata_hash',
                'markets_hash',
                'market_ids_hash',
                'board_hash',
              ].includes(column) &&
              value !== null &&
              !(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
            )
              throw Error('Invalid durable payload reference');
            for (const hash of hashes(value)) {
              if (inventory.has(hash)) {
                roots.add(hash);
                if (name === 'app_mail' && column === 'object_hash') mailRoots.add(hash);
              } else if (
                [
                  'object_hash',
                  'metadata_hash',
                  'markets_hash',
                  'market_ids_hash',
                  'board_hash',
                ].includes(column) &&
                value === hash
              )
                throw Error(
                  'Unresolved durable payload reference; import/backfill before collecting',
                );
            }
          }
        if (rows.length < 100) break;
        const last = rows.at(-1)!;
        cursor = without_rowid ? keys.map((k) => last[k]) : [last._gc_cursor_];
      }
    }
    for (const row of await all<{ hash: string }>('SELECT hash FROM app_storage_pins')) {
      if (!inventory.has(row.hash)) throw Error('Missing recovery pin payload');
      roots.add(row.hash);
    }
    report.rootReferences = roots.size;
    // Decode and integrity-check ALL complete objects, including apparent
    // orphans. Corruption or unknown binary formats abort the sweep, not delete.
    for (const object of objects) {
      if (!object.complete) continue;
      const rows = await all<{
        ordinal: number;
        body: string;
        data: number[] | ArrayBuffer | null;
      }>('SELECT ordinal,body,data FROM app_payload_chunks WHERE hash=? ORDER BY ordinal', [
        object.hash,
      ]);
      if (rows.length !== object.chunks)
        throw Error('Incomplete immutable object; repair before collecting');
      const stored =
        object.inline_data != null
          ? new Uint8Array(object.inline_data as ArrayBuffer)
          : new Uint8Array(object.bytes);
      let offset = object.inline_data != null ? stored.length : 0;
      for (const [i, row] of rows.entries()) {
        if (row.ordinal !== i) throw Error('Invalid immutable chunk ordering');
        const part =
          row.data == null
            ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
            : new Uint8Array(row.data as ArrayBuffer);
        stored.set(part, offset);
        offset += part.length;
      }
      if (offset !== object.bytes) throw Error('Invalid immutable length');
      const bytes = await decodeObject(stored, object.hash),
        text = decode.decode(bytes);
      // Storage.put uses JSON. An unknown opaque object may encode references:
      // fail closed instead of guessing its retention contract.
      const value = JSON.parse(text);
      if (
        value &&
        typeof value === 'object' &&
        value.cipher &&
        value.iv &&
        !mailRoots.has(object.hash)
      )
        throw Error(
          'Opaque encrypted recovery object: collection requires an explicit decoded recovery inventory',
        );
      const check = (v: unknown, key = '') => {
        if (
          typeof v === 'string' &&
          ['root', 'referenceHash', 'bodyHash'].includes(key) &&
          /^[a-f0-9]{64}$/.test(v) &&
          !inventory.has(v)
        )
          throw Error('Missing nested immutable reference; repair before collecting');
        if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) check(child, k);
      };
      check(value);
      edges.set(object.hash, new Set(hashes(text).filter((h) => inventory.has(h))));
    }
    const reachable = new Set<string>(),
      queue = [...roots];
    while (queue.length) {
      const hash = queue.pop()!;
      if (reachable.has(hash)) continue;
      if (!inventory.get(hash)?.complete) throw Error('Durable reference to incomplete object');
      reachable.add(hash);
      queue.push(...(edges.get(hash) ?? []));
    }
    report.reachable = reachable.size;
    const candidates = objects.filter((o) => !reachable.has(o.hash));
    report.candidateObjects = candidates.length;
    report.candidateEncodedBytes = candidates.reduce((s, o) => s + o.bytes, 0);
    if (report.dryRun) return report;
    if (expiredKeys.size)
      await run(
        'DELETE FROM app_ai_cache WHERE cache_key IN (SELECT cache_key FROM app_ai_cache WHERE expires_at<=? AND lease_until<? ORDER BY cache_key LIMIT 500)',
        [now, now],
      );
    if (options.prepareOnly) {
      const epoch = await all<{ epoch: number }>('SELECT epoch FROM app_storage_epoch WHERE id=1');
      const statements = [
        raw
          .prepare(
            "INSERT INTO app_storage_gc_plans(id,epoch,state,created_at) VALUES(?,?,'RUNNING',?)",
          )
          .bind(report.runId, epoch[0].epoch, now),
      ];
      for (let i = 0; i < Math.min(candidates.length, limit); i += 16) {
        const part = candidates.slice(i, Math.min(i + 16, limit));
        statements.push(
          raw
            .prepare(
              'INSERT INTO app_storage_gc_candidates(run_id,hash,bytes) VALUES' +
                part.map(() => '(?,?,?)').join(','),
            )
            .bind(...part.flatMap((o) => [report.runId, o.hash, o.bytes])),
        );
      }
      const result = await raw.batch(statements);
      if (result.some((r) => !r.success)) throw Error('GC plan publication failed');
      holdFence = true;
      return report;
    }
    for (const object of candidates.slice(0, limit)) {
      // The fence remains held. Each object's bytes, manifest, admission and
      // audit record change together. No user/editorial root rows are removed.
      const results = await raw.batch([
        raw.prepare('DELETE FROM app_payload_chunks WHERE hash=?').bind(object.hash),
        raw.prepare('DELETE FROM app_payload_objects WHERE hash=?').bind(object.hash),
        raw
          .prepare('UPDATE app_payload_capacity SET used_bytes=used_bytes-? WHERE id=1')
          .bind(object.bytes),
        raw
          .prepare(
            'INSERT INTO app_storage_gc_audit(run_id,hash,encoded_bytes,deleted_at) VALUES(?,?,?,?)',
          )
          .bind(report.runId, object.hash, object.bytes, now),
      ]);
      report.queries += 4;
      if (results.some((r) => !r.success)) throw Error('GC transaction failed');
      report.rowsRead += results.reduce((s, r) => s + (r.meta.rows_read ?? 0), 0);
      report.rowsWritten += results.reduce((s, r) => s + (r.meta.rows_written ?? 0), 0);
      report.deletedObjects++;
      report.releasedEncodedBytes += object.bytes;
    }
    return report;
  } finally {
    if (!holdFence && options.coordinatedEpoch === undefined)
      await run('UPDATE app_storage_epoch SET locked=0 WHERE id=1');
  }
}
export async function storageCapacity(raw: SqlDatabase) {
  const inventory = await raw
    .prepare(
      'SELECT COALESCE(SUM(bytes),0) AS inventory_bytes,COUNT(*) AS objects,SUM(CASE WHEN complete=0 THEN bytes ELSE 0 END) AS incomplete_bytes,COALESCE((SELECT used_bytes FROM app_payload_capacity WHERE id=1),0) AS reserved_bytes FROM app_payload_objects',
    )
    .all<any>();
  if (!inventory.success) throw Error('Capacity query failed');
  const row = inventory.results[0],
    used = row.reserved_bytes;
  if (used !== row.inventory_bytes)
    throw Error('Capacity counter mismatch: stop writes and reconcile offline');
  const physicalDatabaseBytes =
    Number.isFinite(inventory.meta.size_after) && inventory.meta.size_after > 0
      ? inventory.meta.size_after
      : null;
  const utilization = Math.max(
    used / 64_000_000,
    physicalDatabaseBytes === null ? 0 : physicalDatabaseBytes / 500_000_000,
  );
  return {
    ...row,
    reservedEncodedBytes: used,
    admissionLimit: 64_000_000,
    physicalDatabaseBytes,
    physicalFreeLimit: 500_000_000,
    utilization,
    status: utilization >= 0.9 ? 'critical' : utilization >= 0.7 ? 'warning' : 'ok',
    physicalBytesReclaimed: null,
  };
}
