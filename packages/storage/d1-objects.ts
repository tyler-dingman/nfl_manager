import { digest, objectKey, type Objects, type SqlDatabase } from './core';
import { writeFencedDatabase } from './write-fence';
import { encodeObject, decodeObject } from './codec';
import { PrivateObjects, type Bucket } from './objects';
const CHUNK = 48_000;
const CAPACITY = 64_000_000;
/** Immutable payloads, including historical versions, remain inside the database.
 * Capacity admission is serialized by SQLite; failed uploads retain their reservation
 * and can be retried safely. No automatic deletion of editorial or user history. */
export class StorageCapacityError extends Error {
  constructor() {
    super('D1 payload capacity exhausted; owner intervention required');
  }
}
export class D1Objects implements Objects {
  reads = 0; // R2 operations: deliberately zero.
  writes = 0;
  constructor(readonly db: SqlDatabase) {
    this.db = writeFencedDatabase(db);
  }
  transactionDatabase(_db: SqlDatabase) {
    return this.db;
  }
  async get(key: string): Promise<Uint8Array | null> {
    const hash = key.split('/').at(-1)!;
    if (key !== objectKey(hash)) throw Error('Invalid object key');
    const head = await this.db
      .prepare('SELECT bytes, chunks, complete FROM app_payload_objects WHERE hash=?')
      .bind(hash)
      .first<{ bytes: number; chunks: number; complete: number }>();
    if (!head || !head.complete) return null;
    const result = await this.db
      .prepare('SELECT ordinal, body, data FROM app_payload_chunks WHERE hash=? ORDER BY ordinal')
      .bind(hash)
      .all<{ ordinal: number; body: string; data: number[] | ArrayBuffer | null }>();
    if (!result.success || result.results.length !== head.chunks)
      throw Error('Incomplete D1 payload');
    const bytes = new Uint8Array(head.bytes);
    let offset = 0;
    for (const [i, row] of result.results.entries()) {
      if (row.ordinal !== i) throw Error('Invalid D1 payload order');
      const part =
        row.data == null
          ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
          : new Uint8Array(row.data as ArrayBuffer);
      bytes.set(part, offset);
      offset += part.length;
    }
    if (offset !== head.bytes) throw Error('Invalid D1 payload length');
    return decodeObject(bytes, hash);
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    const hash = await digest(bytes);
    if (key !== objectKey(hash) || bytes.length > 4_000_000)
      throw Error('Invalid immutable payload');
    if (await this.get(key)) return;
    const encoded = await encodeObject(bytes),
      chunks = Math.ceil(encoded.length / CHUNK);
    const reservation = await this.db.batch([
      this.db.prepare('INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)'),
      this.db
        .prepare(
          `INSERT OR IGNORE INTO app_payload_objects(hash,bytes,chunks,complete)
        SELECT ?,?,?,0 WHERE (SELECT used_bytes FROM app_payload_capacity WHERE id=1)+?<=?`,
        )
        .bind(hash, encoded.length, chunks, encoded.length, CAPACITY),
      this.db
        .prepare(
          'UPDATE app_payload_capacity SET used_bytes=used_bytes+? WHERE id=1 AND changes()=1',
        )
        .bind(encoded.length),
    ]);
    if (reservation.some((r) => !r.success)) throw Error('D1 payload admission failed');
    const head = await this.db
      .prepare('SELECT bytes,chunks FROM app_payload_objects WHERE hash=?')
      .bind(hash)
      .first<{ bytes: number; chunks: number }>();
    if (!head) throw new StorageCapacityError();
    if (head.bytes !== encoded.length || head.chunks !== chunks)
      throw Error('Immutable payload collision');
    const statements = [];
    // Eight rows per statement: 24 bindings and <=384KB binary payload. A 4MB
    // object needs 11 INSERT statements rather than exceeding Free's 50 queries.
    for (let i = 0; i < chunks; i += 8) {
      const values: unknown[] = [];
      const count = Math.min(8, chunks - i);
      for (let j = 0; j < count; j++) {
        const ordinal = i + j;
        values.push(hash, ordinal, encoded.slice(ordinal * CHUNK, (ordinal + 1) * CHUNK).buffer);
      }
      statements.push(
        this.db
          .prepare(
            'INSERT OR IGNORE INTO app_payload_chunks(hash,ordinal,data,body) VALUES' +
              Array(count).fill("(?,?,?,'')").join(','),
          )
          .bind(...values),
      );
    }
    for (let i = 0; i < statements.length; i += 40) {
      const results = await this.db.batch(statements.slice(i, i + 40));
      if (results.some((r) => !r.success)) throw Error('D1 payload write failed');
    }
    await this.db
      .prepare('UPDATE app_payload_objects SET complete=1 WHERE hash=?')
      .bind(hash)
      .run();
    const verified = await this.get(key);
    if (!verified || (await digest(verified)) !== hash)
      throw Error('D1 payload verification failed');
  }
}
export function applicationObjects(env: {
  APP_DB: SqlDatabase;
  APP_OBJECT_BACKEND?: string;
  APP_OBJECTS?: Bucket;
  APP_BACKUP?: Bucket;
}) {
  if (env.APP_OBJECT_BACKEND === 'd1') return new D1Objects(env.APP_DB);
  if (env.APP_OBJECT_BACKEND && env.APP_OBJECT_BACKEND !== 'r2')
    throw Error('Unknown object backend');
  if (!env.APP_OBJECTS) throw Error('R2 binding absent: explicitly select APP_OBJECT_BACKEND=d1');
  return new PrivateObjects(env.APP_OBJECTS, env.APP_BACKUP);
}
