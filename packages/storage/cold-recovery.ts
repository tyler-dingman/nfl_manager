import { Storage, digest, utf8, decode, type SqlDatabase } from './core';
import { sealDirectory, unsealDirectory, type DirectoryFormat } from './backup-codec';
import { JsonTree } from './json-tree';
import { decodeObject } from './codec';
import { seal, unseal, unsealBytes } from './mail';

export interface SnapshotObjects {
  /** Fully paginated, frozen namespace, including unreferenced immutable objects. */
  keys(): Promise<string[]>;
  get(key: string): Promise<Uint8Array | null>;
  putImmutable(key: string, bytes: Uint8Array): Promise<void>;
}
type Row = Record<string, string | number | null>;
type Table = { name: string; sql: string; rows: Row[] };
type Manifest = {
  schema: 1 | 2 | 3;
  mode: 'OFFLINE';
  createdAt: number;
  tables: { name: string; sql: string; chunks: string[]; rows: number; hash: string }[];
  chunkDigests?: Record<string, string>;
  objects: { key: string; hash: string; chunks?: string[] }[];
};
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const canonical = (rows: Row[]) => JSON.stringify(rows.map((row) => JSON.stringify(row)).sort());
const requireOffline = (mode: string) => {
  if (mode !== 'OFFLINE_WRITERS_STOPPED')
    throw Error('Cold recovery requires stopped writers and an unserved target');
};
function references(snapshot: Table[]) {
  const keys = new Set<string>();
  for (const table of snapshot)
    for (const row of table.rows) {
      if (table.name.startsWith('app_'))
        for (const field of [
          'object_hash',
          'metadata_hash',
          'markets_hash',
          'market_ids_hash',
          'board_hash',
        ])
          if (typeof row[field] === 'string') keys.add(`application/v1/${row[field]}`);
      if (table.name.startsWith('lean_') && typeof row.object_hash === 'string')
        keys.add(`editorial/lean/v1/${row.object_hash}.json`);
      if (table.name === 'r2_archive_manifests' && typeof row.object_key === 'string')
        keys.add(row.object_key);
      if (table.name === 'editorial_blob_packs' && typeof row.pack_hash === 'string')
        keys.add(`editorial/blobs/v1/${row.pack_hash}`);
    }
  return keys;
}
export async function readFrozenTables(db: SqlDatabase): Promise<Table[]> {
  // Shadow tables are rebuilt through their virtual table; sqlite internal tables
  // and the restore journal are deliberately excluded.
  const catalog = await db
    .prepare(
      "SELECT s.name,s.sql FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name AND p.schema='main' WHERE s.type='table' AND p.type IN ('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' AND s.name NOT LIKE 'app_restore_%' ORDER BY s.rowid",
    )
    .all<{ name: string; sql: string }>();
  if (!catalog.success) throw Error('Cannot read schema');
  const result: Table[] = [];
  let bytes = 0;
  for (let i = 0; i < catalog.results.length; i += 40) {
    const group = catalog.results.slice(i, i + 40),
      data = await db.batch(group.map((t) => db.prepare(`SELECT * FROM ${quote(t.name)}`)));
    for (let j = 0; j < group.length; j++) {
      if (!data[j].success) throw Error('Snapshot read failed');
      const rows = data[j].results as Row[];
      for (const row of rows)
        for (const value of Object.values(row))
          if (value !== null && !['string', 'number'].includes(typeof value))
            throw Error('Binary SQLite rows require an explicit lossless codec');
      bytes += utf8.encode(JSON.stringify(rows)).length;
      if (bytes > 64_000_000)
        throw Error(
          'Offline rehearsal memory ceiling: use streaming backup tooling for larger databases',
        );
      result.push({ ...group[j], rows });
    }
  }
  return result;
}
/** Cold backup only. Does not claim online snapshot isolation across multiple
 * D1 batches. Raw object bytes and every logical table are retained, encrypted
 * in immutable backup chunks. No source object or row is deleted. */
export async function checkpoint(
  db: SqlDatabase,
  source: SnapshotObjects,
  backup: Storage,
  backupObjects: SnapshotObjects,
  secret: string,
  mode: string,
  previousId?: string,
  directoryFormat: DirectoryFormat = 'legacy',
) {
  requireOffline(mode);
  const start = performance.now(),
    snapshot = await readFrozenTables(db);
  const previous = previousId
    ? await unsealDirectory<Manifest>(await backup.get<any>(previousId), secret)
    : undefined;
  if (previous && (previous.schema !== 3 || previous.mode !== 'OFFLINE'))
    throw Error('Invalid previous checkpoint');
  const manifest: Manifest = {
    schema: 3,
    mode: 'OFFLINE',
    createdAt: Date.now(),
    tables: [],
    objects: [],
    chunkDigests: {},
  };
  for (const table of snapshot) {
    const chunks: string[] = [];
    let chunk: Row[] = [],
      size = 0;
    const flush = async () => {
      if (chunk.length) {
        const fingerprint = await digest(utf8.encode(JSON.stringify(chunk)));
        const prior = previous?.chunkDigests?.[fingerprint];
        let hash: string;
        if (prior) {
          const restored = await unsealDirectory<Row[]>(await backup.get<any>(prior), secret);
          if (JSON.stringify(restored) !== JSON.stringify(chunk))
            throw Error('Previous backup chunk mismatch');
          hash = prior;
        } else hash = await backup.put(await sealDirectory(chunk, secret, directoryFormat));
        manifest.chunkDigests![fingerprint] = hash;
        chunks.push(hash);
        chunk = [];
        size = 0;
      }
    };
    for (const row of table.rows) {
      const bytes = utf8.encode(JSON.stringify(row)).length;
      if (bytes > 900_000)
        throw Error(
          'Snapshot row exceeds offline chunk ceiling; move large JSON to R2 before backup',
        );
      if (size + bytes > 900_000) await flush();
      chunk.push(row);
      size += bytes;
    }
    await flush();
    manifest.tables.push({
      name: table.name,
      sql: table.sql,
      chunks,
      rows: table.rows.length,
      hash: await digest(utf8.encode(canonical(table.rows))),
    });
  }
  const keys = (await source.keys()).sort();
  if (new Set(keys).size !== keys.length) throw Error('Repeated object listing');
  for (const key of keys) {
    const bytes = await source.get(key);
    if (!bytes) throw Error(`Missing source object: ${key}`);
    if (bytes.length > 8_000_000)
      throw Error('Snapshot object exceeds bounded rehearsal ceiling; streaming required');
    const namedHash = key.match(/\/([a-f0-9]{64})(?:\.json|\.pack)?$/)?.[1];
    if (namedHash && (await digest(bytes)) !== namedHash) {
      if (key.startsWith('application/v1/')) {
        try {
          await decodeObject(bytes, namedHash);
        } catch {
          throw Error('Corrupt content-addressed source object');
        }
      } else throw Error('Corrupt content-addressed source object');
    }
    const prior = await backupObjects.get(key);
    if (prior && (await digest(prior)) !== (await digest(bytes)))
      throw Error('Backup immutable object collision');
    await backupObjects.putImmutable(key, bytes);
    const verified = await backupObjects.get(key);
    if (!verified || (await digest(verified)) !== (await digest(bytes)))
      throw Error('Backup object verification failed');
    manifest.objects.push({ key, hash: await digest(bytes) });
  }
  // Validate shared tree edges as well as D1 head pointers. A missing child must
  // prevent checkpoint publication, even when every remaining object hashes.
  await validateFrozenReferences(db, snapshot, source, keys);
  // Detect changes during the copy; the explicit stopped-writers precondition
  // remains necessary, including writes after this comparison.
  if (
    JSON.stringify(snapshot) !== JSON.stringify(await readFrozenTables(db)) ||
    JSON.stringify(keys) !== JSON.stringify((await source.keys()).sort())
  )
    throw Error('Source changed during cold backup');
  for (const object of manifest.objects) {
    const bytes = await source.get(object.key);
    if (!bytes || (await digest(bytes)) !== object.hash)
      throw Error('Source object changed during backup');
  }
  const unchanged =
    previous &&
    JSON.stringify(previous.tables) === JSON.stringify(manifest.tables) &&
    JSON.stringify(previous.objects) === JSON.stringify(manifest.objects);
  const id = unchanged
    ? previousId!
    : await backup.put(await sealDirectory(manifest, secret, directoryFormat));
  return {
    id,
    reusedCheckpoint: Boolean(unchanged),
    reusedChunks: Object.values(manifest.chunkDigests!).filter((h) =>
      Object.values(previous?.chunkDigests ?? {}).includes(h),
    ).length,
    tables: manifest.tables.length,
    rows: manifest.tables.reduce((n, t) => n + t.rows, 0),
    objects: keys.length,
    milliseconds: performance.now() - start,
  };
}
/** Additive restore into pre-migrated, unserved synthetic bindings. Chunk
 * receipts and INSERT OR IGNORE make interruption resumable. Final exact row
 * and object verification prevents a pre-existing collision being accepted. */
export async function restore(
  db: SqlDatabase,
  target: SnapshotObjects,
  backup: Storage,
  backupObjects: SnapshotObjects,
  secret: string,
  id: string,
  mode: string,
  afterChunk?: () => void,
) {
  requireOffline(mode);
  const start = performance.now(),
    manifest = await unsealDirectory<Manifest>(await backup.get<any>(id), secret);
  if (![1, 2, 3].includes(manifest.schema) || manifest.mode !== 'OFFLINE')
    throw Error('Unknown checkpoint version');
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS app_restore_journal(checkpoint TEXT PRIMARY KEY,status TEXT NOT NULL)',
    )
    .run();
  const journals = await db
    .prepare('SELECT * FROM app_restore_journal')
    .all<{ checkpoint: string; status: string }>();
  if (journals.results.some((r) => r.checkpoint !== id))
    throw Error('Restore target belongs to another checkpoint');
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS app_restore_chunks(checkpoint TEXT NOT NULL,chunk TEXT PRIMARY KEY)',
    )
    .run();
  const existing = await readFrozenTables(db);
  if (
    !journals.results.length &&
    existing.some((t) => !['nfl_teams', 'content_control'].includes(t.name) && t.rows.length)
  )
    throw Error('Restore requires a new empty unserved target');
  if (
    existing.length !== manifest.tables.length ||
    manifest.tables.some((t) => existing.find((e) => e.name === t.name)?.sql !== t.sql)
  )
    throw Error('Restore schema mismatch; apply the same additive migrations first');
  await db
    .prepare(
      "INSERT INTO app_restore_journal(checkpoint,status) VALUES(?,'RESTORING') ON CONFLICT(checkpoint) DO UPDATE SET status='RESTORING'",
    )
    .bind(id)
    .run();
  // Objects precede D1 references; partial targets must never be served.
  for (const object of manifest.objects) {
    let bytes: Uint8Array;
    if (manifest.schema === 3) {
      const value = await backupObjects.get(object.key);
      if (!value) throw Error('Missing backup object');
      bytes = value;
    } else {
      const parts: Uint8Array[] = [];
      for (const hash of object.chunks ?? []) {
        if (manifest.schema === 1) {
          const data = await unseal<{ bytes: number[] }>(await backup.get<any>(hash), secret);
          parts.push(new Uint8Array(data.bytes));
        } else parts.push(await unsealBytes(await backup.get<any>(hash), secret));
      }
      bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
    }
    if ((await digest(bytes)) !== object.hash) throw Error('Backup object digest mismatch');
    const prior = await target.get(object.key);
    if (prior && (await digest(prior)) !== object.hash) throw Error('Target object collision');
    await target.putImmutable(object.key, bytes);
    const verified = await target.get(object.key);
    if (!verified || (await digest(verified)) !== object.hash)
      throw Error('Restore object verification failed');
    afterChunk?.();
  }
  for (const table of manifest.tables) {
    for (const hash of table.chunks) {
      const rows = await unsealDirectory<Row[]>(await backup.get<any>(hash), secret);
      for (let i = 0; i < rows.length; i += 40) {
        const chunkId = `${id}:${table.name}:${hash}:${i}`;
        if (
          await db.prepare('SELECT 1 FROM app_restore_chunks WHERE chunk=?').bind(chunkId).first()
        )
          continue;
        const batch = rows.slice(i, i + 40).map((row) => {
          const names = Object.keys(row);
          if (names.length > 100) throw Error('Restore parameter ceiling');
          return db
            .prepare(
              `INSERT OR IGNORE INTO ${quote(table.name)}(${names.map(quote).join(',')}) VALUES(${names.map(() => '?').join(',')})${table.name === 'content_control' ? ' ON CONFLICT(key) DO UPDATE SET version=excluded.version,value_json=excluded.value_json' : table.name === 'nfl_teams' ? ' ON CONFLICT(id) DO UPDATE SET abbr=excluded.abbr' : ''}`,
            )
            .bind(...Object.values(row));
        });
        batch.push(
          db
            .prepare('INSERT INTO app_restore_chunks(checkpoint,chunk) VALUES(?,?)')
            .bind(id, chunkId),
        );
        const result = await db.batch(batch);
        if (result.some((r) => !r.success)) throw Error('Restore batch failed');
        afterChunk?.();
      }
    }
    const result = await db.prepare(`SELECT * FROM ${quote(table.name)}`).all<Row>();
    if (
      result.results.length !== table.rows ||
      (await digest(utf8.encode(canonical(result.results)))) !== table.hash
    )
      throw Error(`Restored rows differ: ${table.name}`);
  }
  const foreign = await db.prepare('PRAGMA foreign_key_check').all();
  if (foreign.results.length) throw Error('Restored foreign key violation');
  await db
    .prepare("UPDATE app_restore_journal SET status='READY' WHERE checkpoint=?")
    .bind(id)
    .run();
  return {
    tables: manifest.tables.length,
    objects: manifest.objects.length,
    milliseconds: performance.now() - start,
    status: 'READY' as const,
  };
}

export async function validateFrozenReferences(
  db: SqlDatabase,
  snapshot: Table[],
  source: SnapshotObjects,
  keys: string[],
) {
  for (const key of references(snapshot))
    if (!keys.includes(key))
      throw Error(`D1 reference is missing from the object inventory: ${key}`);
  const logical = new Storage(db, {
    get: async (key) => {
      const bytes = await source.get(key);
      return bytes ? decodeObject(bytes, key.split('/').at(-1)!) : null;
    },
    putImmutable: async () => {
      throw Error('Frozen source');
    },
  });
  const treeTables = new Set([
    'app_heads',
    'app_receipts',
    'app_odds_history',
    'app_franchise_heads',
    'app_franchise_commands',
    'app_sportsbook_events',
    'app_odds_board_history',
  ]);
  const applicationHashes = new Set(
    snapshot
      .filter((t) => treeTables.has(t.name))
      .flatMap((t) =>
        t.rows.flatMap((row) =>
          ['object_hash', 'markets_hash', 'market_ids_hash'].flatMap((field) =>
            typeof row[field] === 'string' ? [String(row[field])] : [],
          ),
        ),
      ),
  );
  const checked = new Set<string>();
  async function validateGraph(hash: string): Promise<void> {
    if (checked.has(hash)) return;
    checked.add(hash);
    const value = await logical.get<any>(hash);
    if (value?.root && [1, 2].includes(value.schema)) {
      const content = await new JsonTree(logical).get<any>(value.root);
      if (value.saveId && content?.referenceHash) await logical.get(content.referenceHash);
    }
    if (value?.saveId && value?.stateHash) await validateGraph(value.stateHash);
  }
  for (const hash of applicationHashes) await validateGraph(hash);
}
