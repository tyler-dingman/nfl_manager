import { EditorialDatabase } from './database';
import { sha, type PrivateArchiveObjects } from './r2-archive';

const TABLES = [
  'lean_heads',
  'lean_versions',
  'lean_teams',
  'lean_receipts',
  'odds_refresh_slots',
] as const;
type Tables = Record<(typeof TABLES)[number], Record<string, unknown>[]>;
export interface LeanCheckpoint {
  format: 'dd-lean-checkpoint-v1';
  tables: Tables;
  manifestHash: string;
  objects: { key: string; hash: string; bytes: number }[];
}
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const keyFor = (hash: string) => {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('Invalid checkpoint object identity');
  return `editorial/lean/v1/${hash}.json`;
};
const hashes = (tables: Tables) =>
  [
    ...new Set(
      [...tables.lean_heads, ...tables.lean_versions, ...tables.lean_receipts].map((row) =>
        String(row.object_hash),
      ),
    ),
  ].sort();

/** Offline, exclusive-maintenance operation. D1 batch obtains one directory snapshot.
 * Immutable objects cannot change between that snapshot and copy verification.
 * Scope is the selected lean POC, not the legacy/editorial or PostgreSQL databases.
 * A full database may exceed Worker memory: this is not a production HTTP handler.
 */
export async function createLeanCheckpoint(
  db: EditorialDatabase,
  source: PrivateArchiveObjects,
  backup: PrivateArchiveObjects,
): Promise<LeanCheckpoint> {
  const rows = await db.batch(
    'checkpoint.snapshot',
    TABLES.map((table) => db.statement(`SELECT * FROM ${table}`)),
  );
  const tables = Object.fromEntries(TABLES.map((table, i) => [table, rows[i].results])) as Tables;
  const objects: LeanCheckpoint['objects'] = [];
  for (const hash of hashes(tables)) {
    const key = keyFor(hash),
      bytes = await source.get(key);
    if (!bytes || (await sha(bytes)) !== hash)
      throw Error('Checkpoint source is missing or corrupt');
    await backup.putImmutable(key, bytes);
    const copy = await backup.get(key);
    if (!copy || (await sha(copy)) !== hash) throw Error('Checkpoint backup verification failed');
    objects.push({ key, hash, bytes: bytes.length });
  }
  return {
    format: 'dd-lean-checkpoint-v1',
    tables,
    objects,
    manifestHash: await sha(encode({ tables, objects })),
  };
}

/** Restore into an empty, exclusively held synthetic target. Verify everything first.
 * R2 copies precede one atomic SQL batch, so an error cannot expose dangling pointers.
 * Larger production datasets need chunked, staged import plus a final pointer switch.
 */
export async function restoreLeanCheckpoint(
  db: EditorialDatabase,
  source: PrivateArchiveObjects,
  target: PrivateArchiveObjects,
  checkpoint: LeanCheckpoint,
) {
  const { tables, objects } = checkpoint;
  if (
    checkpoint.format !== 'dd-lean-checkpoint-v1' ||
    (await sha(encode({ tables, objects }))) !== checkpoint.manifestHash
  )
    throw Error('Checkpoint manifest checksum mismatch');
  const expected = hashes(tables);
  if (
    JSON.stringify(expected) !== JSON.stringify(objects.map((o) => o.hash).sort()) ||
    new Set(objects.map((o) => o.hash)).size !== objects.length
  )
    throw Error('Checkpoint reference inventory mismatch');
  const verified = [];
  for (const object of objects) {
    if (object.key !== keyFor(object.hash)) throw Error('Invalid checkpoint key');
    const bytes = await source.get(object.key);
    if (!bytes || bytes.length !== object.bytes || (await sha(bytes)) !== object.hash)
      throw Error('Checkpoint object is missing or corrupt');
    verified.push({ key: object.key, bytes });
  }
  const counts = await db.batch(
    'checkpoint.empty-target',
    TABLES.map((table) => db.statement(`SELECT count(*) AS n FROM ${table}`)),
  );
  if (counts.some((r) => Number((r.results[0] as { n: number }).n) !== 0))
    throw Error('Checkpoint target must be empty');
  const columns = await db.batch(
    'checkpoint.columns',
    TABLES.map((table) => db.statement(`PRAGMA table_info(${table})`)),
  );
  const statements = TABLES.flatMap((table, i) =>
    tables[table].map((row) => {
      const names = columns[i].results.map((col) => String((col as { name: string }).name));
      if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify([...names].sort()))
        throw Error('Checkpoint schema mismatch');
      return db.statement(
        `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`,
        names.map((n) => row[n]),
      );
    }),
  );
  if (statements.length > 50)
    throw Error('Offline fixture restore exceeds single atomic D1 batch; staged importer required');
  for (const object of verified) {
    await target.putImmutable(object.key, object.bytes);
    const copy = await target.get(object.key);
    if (!copy || (await sha(copy)) !== (await sha(object.bytes)))
      throw Error('Restore target verification failed');
  }
  if (statements.length) await db.batch('checkpoint.restore', statements);
  return { rows: statements.length, objects: verified.length };
}
