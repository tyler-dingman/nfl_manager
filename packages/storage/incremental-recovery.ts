import { Storage, digest, utf8, type SqlDatabase } from './core';
import {
  checkpoint,
  restore,
  readFrozenTables,
  validateFrozenReferences,
  type SnapshotObjects,
} from './cold-recovery';
import { sealDirectory, unsealDirectory } from './backup-codec';
import { decodeObject } from './codec';
import { D1ApplicationSettings } from './lifecycle';
type Row = Record<string, string | number | null>;
type Table = { name: string; sql: string; rows: Row[] };
type ObjectRef = { key: string; hash: string };
type Patch = {
  name: string;
  sql: string;
  before: string;
  after: string;
  remove: string[];
  add: Row[];
};
type Point = {
  schema: 1;
  kind: 'WEEKLY_FULL' | 'DAILY_DELTA';
  createdAt: number;
  depth: number;
  full?: string;
  parent?: string;
  patches?: string[];
  added?: ObjectRef[];
  removed?: string[];
};
const tableHash = (rows: Row[]) =>
  digest(utf8.encode(JSON.stringify(rows.map((r) => JSON.stringify(r)).sort())));
const requireOffline = (mode: string) => {
  if (mode !== 'OFFLINE_WRITERS_STOPPED')
    throw Error('Stop writers and keep restore target unserved');
};
async function readPoint(s: Storage, id: string, secret: string) {
  const p = await unsealDirectory<Point>(await s.get(id), secret);
  if (
    p.schema !== 1 ||
    !['WEEKLY_FULL', 'DAILY_DELTA'].includes(p.kind) ||
    !Number.isSafeInteger(p.depth) ||
    p.depth < 0 ||
    p.depth > 6
  )
    throw Error('Invalid recovery point');
  return p;
}
/** Each weekly full resets the chain. Daily deltas preserve all row bytes and
 * exact immutable inventories; no application data is discarded by this policy. */
export async function materializePoint(
  s: Storage,
  id: string,
  secret: string,
  seen = new Set<string>(),
): Promise<{ tables: Table[]; objects: ObjectRef[]; point: Point }> {
  if (seen.has(id) || seen.size > 6) throw Error('Recovery chain cycle or depth');
  seen.add(id);
  const point = await readPoint(s, id, secret);
  if (point.kind === 'WEEKLY_FULL') {
    if (point.depth !== 0 || !point.full) throw Error('Invalid full checkpoint');
    const full = await unsealDirectory<any>(await s.get(point.full), secret);
    if (full.schema !== 3 || full.mode !== 'OFFLINE') throw Error('Unsupported full checkpoint');
    const tables: Table[] = [];
    for (const t of full.tables) {
      const rows: Row[] = [];
      for (const h of t.chunks)
        rows.push(...(await unsealDirectory<Row[]>(await s.get(h), secret)));
      if (rows.length !== t.rows || (await tableHash(rows)) !== t.hash)
        throw Error('Full checkpoint row integrity');
      tables.push({ name: t.name, sql: t.sql, rows });
    }
    return { tables, objects: full.objects, point };
  }
  if (!point.parent || !point.depth) throw Error('Incomplete recovery chain');
  const previous = await materializePoint(s, point.parent, secret, seen);
  if (previous.point.depth + 1 !== point.depth || previous.point.createdAt >= point.createdAt)
    throw Error('Recovery chain ordering');
  for (const hash of point.patches ?? []) {
    const patch = await unsealDirectory<Patch>(await s.get(hash), secret),
      table = previous.tables.find((t) => t.name === patch.name);
    if (!table || table.sql !== patch.sql || (await tableHash(table.rows)) !== patch.before)
      throw Error('Delta base mismatch');
    // A multiset preserves duplicates in virtual/search tables without inventing IDs.
    const rows = table.rows.map((r) => JSON.stringify(r));
    for (const removed of patch.remove) {
      const i = rows.indexOf(removed);
      if (i < 0) throw Error('Delta removes absent row');
      rows.splice(i, 1);
    }
    rows.push(...patch.add.map((r) => JSON.stringify(r)));
    table.rows = rows.map((r) => JSON.parse(r));
    if ((await tableHash(table.rows)) !== patch.after) throw Error('Delta result mismatch');
  }
  const objects = new Map(previous.objects.map((o) => [o.key, o]));
  for (const key of point.removed ?? []) {
    if (!objects.delete(key)) throw Error('Delta removes absent object');
  }
  for (const o of point.added ?? []) {
    if (objects.has(o.key)) throw Error('Delta replaces immutable object');
    objects.set(o.key, o);
  }
  return {
    tables: previous.tables,
    objects: [...objects.values()].sort((a, b) => a.key.localeCompare(b.key)),
    point,
  };
}
export async function incrementalCheckpoint(
  db: SqlDatabase,
  source: SnapshotObjects,
  backup: Storage,
  bodies: SnapshotObjects,
  secret: string,
  mode: string,
  previousId?: string,
  now = Date.now(),
) {
  requireOffline(mode);
  const prior = previousId ? await materializePoint(backup, previousId, secret) : null;
  if (!prior || prior.point.depth === 6 || now - prior.point.createdAt > 2 * 86400000) {
    const full = await checkpoint(db, source, backup, bodies, secret, mode);
    const point: Point = {
      schema: 1,
      kind: 'WEEKLY_FULL',
      createdAt: now,
      depth: 0,
      full: full.id,
    };
    return {
      id: await backup.put(await sealDirectory(point, secret)),
      kind: point.kind,
      depth: 0,
      changedRows: full.rows,
      full,
    };
  }
  if (now <= prior.point.createdAt) throw Error('Recovery time must advance');
  const tables = await readFrozenTables(db);
  if (
    tables.length !== prior.tables.length ||
    tables.some((t) => prior.tables.find((p) => p.name === t.name)?.sql !== t.sql)
  )
    throw Error('Schema changed: take a new weekly full without a parent');
  const patches: string[] = [];
  let changedRows = 0;
  for (const table of tables) {
    const before = prior.tables.find((t) => t.name === table.name)!;
    const old = new Map<string, number>();
    for (const r of before.rows) {
      const k = JSON.stringify(r);
      old.set(k, (old.get(k) ?? 0) + 1);
    }
    const add: Row[] = [];
    for (const row of table.rows) {
      const key = JSON.stringify(row),
        count = old.get(key) ?? 0;
      if (count) old.set(key, count - 1);
      else add.push(row);
    }
    const remove = [...old].flatMap(([key, count]) => Array(count).fill(key));
    if (!add.length && !remove.length) continue;
    // Bound encryption/object size, even when many rows change at once.
    const originalRows = before.rows.map((r) => JSON.stringify(r));
    const operations = [
      ...remove.map((value) => ({ remove: value })),
      ...add.map((value) => ({ add: value })),
    ];
    for (let offset = 0; offset < operations.length; ) {
      const batch: typeof operations = [];
      let bytes = 0;
      while (
        offset < operations.length &&
        bytes + utf8.encode(JSON.stringify(operations[offset])).length < 700000
      ) {
        const op = operations[offset++];
        batch.push(op);
        bytes += utf8.encode(JSON.stringify(op)).length;
      }
      if (!batch.length) throw Error('Delta row exceeds offline pack ceiling');
      const hashBefore = await tableHash(originalRows.map((r) => JSON.parse(r)));
      const removals: string[] = [],
        adds: Row[] = [];
      for (const op of batch)
        if ('remove' in op) {
          removals.push(op.remove!);
          const i = originalRows.indexOf(op.remove!);
          if (i < 0) throw Error('Invalid local delta');
          originalRows.splice(i, 1);
        } else {
          adds.push(op.add!);
          originalRows.push(JSON.stringify(op.add));
        }
      patches.push(
        await backup.put(
          await sealDirectory(
            {
              name: table.name,
              sql: table.sql,
              before: hashBefore,
              after: await tableHash(originalRows.map((r) => JSON.parse(r))),
              remove: removals,
              add: adds,
            } satisfies Patch,
            secret,
          ),
        ),
      );
    }
    changedRows += add.length + remove.length;
  }
  const keys = (await source.keys()).sort(),
    previousObjects = new Map(prior.objects.map((o) => [o.key, o]));
  if (new Set(keys).size !== keys.length) throw Error('Repeated object inventory');
  const added: ObjectRef[] = [];
  for (const key of keys) {
    const bytes = await source.get(key);
    if (!bytes) throw Error('Missing source object');
    const hash = await digest(bytes),
      old = previousObjects.get(key);
    if (old) {
      if (old.hash !== hash) throw Error('Immutable source object changed');
      continue;
    }
    const named = key.match(/\/([a-f0-9]{64})(?:\.json|\.pack)?$/)?.[1];
    if (named && named !== hash) {
      if (key.startsWith('application/v1/')) await decodeObject(bytes, named);
      else throw Error('Source object integrity');
    }
    const existing = await bodies.get(key);
    if (existing && (await digest(existing)) !== hash) throw Error('Backup object collision');
    await bodies.putImmutable(key, bytes);
    const copied = await bodies.get(key);
    if (!copied || (await digest(copied)) !== hash) throw Error('Backup object verification');
    added.push({ key, hash });
  }
  await validateFrozenReferences(db, tables, source, keys);
  const removed = prior.objects.filter((o) => !keys.includes(o.key)).map((o) => o.key);
  if (
    JSON.stringify(tables) !== JSON.stringify(await readFrozenTables(db)) ||
    JSON.stringify(keys) !== JSON.stringify((await source.keys()).sort())
  )
    throw Error('Writers changed source during backup');
  const point: Point = {
    schema: 1,
    kind: 'DAILY_DELTA',
    createdAt: now,
    depth: prior.point.depth + 1,
    parent: previousId,
    patches,
    added,
    removed,
  };
  const id = await backup.put(await sealDirectory(point, secret));
  await materializePoint(backup, id, secret);
  return { id, kind: point.kind, depth: point.depth, changedRows, addedObjects: added.length };
}
/** Persist the prepared full manifest ID so interruptions reuse one restore
 * journal. AES-GCM remains randomized; no custom/convergent encryption. */
export async function prepareIncrementalRestore(backup: Storage, point: string, secret: string) {
  const settings = new D1ApplicationSettings(backup),
    key = 'restore-assembly:' + point,
    previous = await settings.read(key);
  if (previous) return (previous.value as any).id as string;
  const data = await materializePoint(backup, point, secret),
    tables = [];
  for (const table of data.tables) {
    const chunks: string[] = [];
    let rows: Row[] = [];
    let bytes = 0;
    const flush = async () => {
      if (rows.length) chunks.push(await backup.put(await sealDirectory(rows, secret)));
      rows = [];
      bytes = 0;
    };
    for (const row of table.rows) {
      const length = utf8.encode(JSON.stringify(row)).length;
      if (length > 900000) throw Error('Restore row ceiling');
      if (bytes + length > 900000) await flush();
      rows.push(row);
      bytes += length;
    }
    await flush();
    tables.push({
      name: table.name,
      sql: table.sql,
      chunks,
      rows: table.rows.length,
      hash: await tableHash(table.rows),
    });
  }
  const id = await backup.put(
    await sealDirectory(
      {
        schema: 3,
        mode: 'OFFLINE',
        createdAt: data.point.createdAt,
        tables,
        objects: data.objects,
        chunkDigests: {},
      },
      secret,
    ),
  );
  if (await settings.compareAndSet(key, 0, { id, point })) return id;
  return ((await settings.read(key))!.value as any).id as string;
}
export async function restoreIncremental(
  db: SqlDatabase,
  target: SnapshotObjects,
  backup: Storage,
  bodies: SnapshotObjects,
  secret: string,
  point: string,
  mode: string,
  afterChunk?: () => void,
) {
  requireOffline(mode);
  const id = await prepareIncrementalRestore(backup, point, secret);
  return restore(db, target, backup, bodies, secret, id, mode, afterChunk);
}
/** Planning only: never deletes application objects or executes an R2 purge.
 * Keep 35 daily points and every base/parent needed by those exact points. */
export async function planRecoveryRetention(
  backup: Storage,
  points: { id: string; createdAt: number }[],
  secret: string,
  now = Date.now(),
  days = 35,
) {
  if (!Number.isInteger(days) || days < 7 || days > 365)
    throw Error('Recovery retention must be 7–365 days');
  const retained = new Set(
    points.filter((p) => p.createdAt >= now - days * 86400000).map((p) => p.id),
  );
  if (points.length) retained.add([...points].sort((a, b) => b.createdAt - a.createdAt)[0].id);
  const visit = async (id: string) => {
    const p = await readPoint(backup, id, secret);
    if (p.parent && !retained.has(p.parent)) {
      retained.add(p.parent);
      await visit(p.parent);
    }
  };
  for (const id of [...retained]) await visit(id);
  return {
    objective: {
      rpoHours: 24,
      dailyRewindDays: days,
      maxDeltaDepth: 6,
      requiresStoppedWriters: true,
    },
    keep: [...retained],
    expiredPoints: points.filter((p) => !retained.has(p.id)).map((p) => p.id),
    deletionExecuted: false,
    bodyObjectsNeverDeleted: true,
  };
}
/** Exclusive offline retention for directory records minted by this module.
 * Never list/delete the payload bucket. The caller persists the returned catalog
 * only after success, and retains it unchanged if deletion is interrupted. */
export async function pruneRecoveryDirectories(
  backup: Storage,
  points: { id: string; createdAt: number }[],
  secret: string,
  deleteDirectory: (hash: string) => Promise<void>,
  mode: string,
  now = Date.now(),
  days = 35,
) {
  if (mode !== 'OFFLINE_BACKUP_WRITERS_STOPPED')
    throw Error('Stop backup writers before retention');
  const settings = new D1ApplicationSettings(backup),
    journalKey = 'directory-retention-journal';
  const fingerprint = await digest(utf8.encode(JSON.stringify({ points, days })));
  let saved = await settings.read(journalKey);
  if (saved && (saved.value as any).fingerprint !== fingerprint && !(saved.value as any).done)
    throw Error('Resume pending retention with its original catalog');
  const finish = async (value: any, version: number) => {
    const ledger = await unsealDirectory<any>(await backup.get(value.hash), secret);
    if (!value.done) {
      for (const hash of ledger.expired) await deleteDirectory(hash);
      if (!(await settings.compareAndSet(journalKey, version, { ...value, done: true })))
        throw Error('Retention journal changed');
    }
    return {
      ...ledger.plan,
      deletionExecuted: true,
      deletedDirectoryRecords: ledger.expired.length,
      catalog: ledger.catalog,
    };
  };
  if (saved && (saved.value as any).fingerprint === fingerprint)
    return finish(saved.value, saved.version);
  const plan = await planRecoveryRetention(backup, points, secret, now, days),
    all = new Set<string>(),
    keep = new Set<string>();
  const collect = async (id: string, into: Set<string>) => {
    if (into.has(id)) return;
    into.add(id);
    const p = await readPoint(backup, id, secret);
    if (p.full) {
      into.add(p.full);
      const full = await unsealDirectory<any>(await backup.get(p.full), secret);
      for (const t of full.tables) for (const h of t.chunks) into.add(h);
    }
    for (const h of p.patches ?? []) into.add(h);
    if (p.parent) await collect(p.parent, into);
    const assembly = await new D1ApplicationSettings(backup).read('restore-assembly:' + id);
    if (assembly) {
      const h = (assembly.value as any).id;
      into.add(h);
      const full = await unsealDirectory<any>(await backup.get(h), secret);
      for (const t of full.tables) for (const c of t.chunks) into.add(c);
    }
  };
  for (const p of points) await collect(p.id, all);
  for (const id of plan.keep) await collect(id, keep);
  const expired = [...all].filter((h) => !keep.has(h));
  // Validate every retained record before the first irreversible directory purge.
  for (const hash of keep) await backup.get(hash);
  const hash = await backup.put(
    await sealDirectory(
      { plan, expired, catalog: points.filter((p) => plan.keep.includes(p.id)) },
      secret,
    ),
  );
  if (
    !(await settings.compareAndSet(journalKey, saved?.version ?? 0, {
      hash,
      fingerprint,
      done: false,
    }))
  )
    throw Error('Retention journal changed');
  saved = await settings.read(journalKey);
  return finish(saved!.value, saved!.version);
}
