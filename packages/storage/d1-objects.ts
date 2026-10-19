import { digest, objectKey, type Objects, type SqlDatabase } from './core';
import { StorageMaintenanceError, writeFencedDatabase } from './write-fence';
import { encodeObject, decodeObject } from './codec';
import { PrivateObjects, type Bucket } from './objects';
const CHUNK = 48_000,
  CAPACITY = 64_000_000;
export class StorageCapacityError extends Error {
  constructor() {
    super('D1 payload capacity exhausted; owner intervention required');
  }
}
export class D1Objects implements Objects {
  reads = 0;
  writes = 0;
  readonly compactTrees = true;
  private verified = new Map<string, Uint8Array>();
  private cachedBytes = 0;
  private encoded = new Map<string, Uint8Array>();
  private encodedBytes = 0;
  private incomplete = new Map<string, { bytes: number; chunks: number }>();
  constructor(readonly db: SqlDatabase) {
    this.db = writeFencedDatabase(db);
  }
  transactionDatabase(_db: SqlDatabase) {
    return this.db;
  }
  private remember(key: string, bytes: Uint8Array) {
    if (this.cachedBytes + bytes.length <= 8_000_000 && !this.verified.has(key)) {
      this.verified.set(key, bytes.slice());
      this.cachedBytes += bytes.length;
    }
  }
  /** Inline-only batch read: bounded encoded memory, lazy decode/integrity check.
   * Large/chunked objects retain the verified single-object fallback. */
  async prefetch(keys: string[]) {
    const hashes = [
      ...new Set(
        keys
          .filter((key) => !this.verified.has(key) && !this.encoded.has(key))
          .map((key) => {
            const hash = key.split('/').at(-1)!;
            if (key !== objectKey(hash)) throw Error('Invalid object key');
            return hash;
          }),
      ),
    ];
    for (let i = 0; i < hashes.length && this.encodedBytes < 2_000_000; i += 32) {
      const result = await this.db
        .prepare(
          'SELECT hash,bytes,inline_data FROM app_payload_objects WHERE hash IN (SELECT value FROM json_each(?)) AND complete=1 AND chunks=0 AND inline_data IS NOT NULL',
        )
        .bind(JSON.stringify(hashes.slice(i, i + 32)))
        .all<{ hash: string; bytes: number; inline_data: ArrayBuffer }>();
      if (!result.success) throw Error('D1 payload prefetch failed');
      for (const row of result.results) {
        const bytes = new Uint8Array(row.inline_data);
        if (bytes.length !== row.bytes) throw Error('Invalid payload length');
        if (this.encodedBytes + bytes.length > 2_000_000) break;
        this.encoded.set(objectKey(row.hash), bytes);
        this.encodedBytes += bytes.length;
      }
    }
  }
  async get(key: string): Promise<Uint8Array | null> {
    const hash = key.split('/').at(-1)!;
    if (key !== objectKey(hash)) throw Error('Invalid object key');
    const cached = this.verified.get(key);
    if (cached) return cached.slice();
    const prefetched = this.encoded.get(key);
    if (prefetched) {
      const decoded = await decodeObject(prefetched, hash);
      this.encoded.delete(key);
      this.encodedBytes -= prefetched.length;
      this.remember(key, decoded);
      return decoded.slice();
    }
    const result = await this.db
      .prepare(
        `SELECT o.bytes,o.chunks,o.complete,o.inline_data,c.ordinal,c.body,c.data
    FROM app_payload_objects o LEFT JOIN app_payload_chunks c ON c.hash=o.hash
    WHERE o.hash=? ORDER BY c.ordinal`,
      )
      .bind(hash)
      .all<{
        bytes: number;
        chunks: number;
        complete: number;
        inline_data: number[] | ArrayBuffer | null;
        ordinal: number | null;
        body: string | null;
        data: number[] | ArrayBuffer | null;
      }>();
    if (!result.success) throw Error('D1 payload read failed');
    const head = result.results[0];
    if (!head) return null;
    if (!head.complete) {
      this.incomplete.set(key, { bytes: head.bytes, chunks: head.chunks });
      return null;
    }
    let stored: Uint8Array;
    if (head.inline_data != null) {
      if (head.chunks !== 0 || result.results.length !== 1) throw Error('Invalid inline payload');
      stored = new Uint8Array(head.inline_data as ArrayBuffer);
    } else {
      const rows = head.chunks === 0 ? [] : result.results;
      if (rows.length !== head.chunks) throw Error('Incomplete D1 payload');
      stored = new Uint8Array(head.bytes);
      let offset = 0;
      for (const [i, row] of rows.entries()) {
        if (row.ordinal !== i) throw Error('Invalid chunk ordering');
        const part =
          row.data == null
            ? Uint8Array.from(atob(row.body!), (c) => c.charCodeAt(0))
            : new Uint8Array(row.data as ArrayBuffer);
        stored.set(part, offset);
        offset += part.length;
      }
      if (offset !== head.bytes) throw Error('Invalid chunk length');
    }
    if (stored.length !== head.bytes) throw Error('Invalid payload length');
    const decoded = await decodeObject(stored, hash);
    this.remember(key, decoded);
    return decoded.slice();
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    const hash = await digest(bytes);
    if (key !== objectKey(hash) || bytes.length > 4_000_000)
      throw Error('Invalid immutable payload');
    if (await this.get(key)) return;
    const encoded = await encodeObject(bytes),
      inline = encoded.length <= CHUNK && !this.incomplete.get(key)?.chunks,
      chunks = inline ? 0 : Math.ceil(encoded.length / CHUNK);
    const pending = this.incomplete.get(key);
    if (pending && (pending.bytes !== encoded.length || pending.chunks !== chunks))
      throw Error('Incomplete legacy payload encoding differs; owner repair required');
    const statements = [
      this.db.prepare('INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)'),
      this.db
        .prepare(
          `INSERT OR IGNORE INTO app_payload_objects(hash,bytes,chunks,complete,inline_data)
    SELECT ?,?,?,?,? WHERE (SELECT used_bytes FROM app_payload_capacity WHERE id=1)+?<=?`,
        )
        .bind(
          hash,
          encoded.length,
          chunks,
          inline ? 1 : 0,
          inline ? encoded.slice().buffer : null,
          encoded.length,
          CAPACITY,
        ),
      this.db
        .prepare(
          'UPDATE app_payload_capacity SET used_bytes=used_bytes+? WHERE id=1 AND changes()=1',
        )
        .bind(encoded.length),
    ];
    if (!inline) {
      const nonce = crypto.randomUUID();
      statements.push(
        this.db
          .prepare(
            'INSERT INTO app_storage_guards(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM app_payload_objects WHERE hash=? AND bytes=? AND chunks=?) THEN 1 ELSE 0 END',
          )
          .bind(nonce, hash, encoded.length, chunks),
      );
      for (let i = 0; i < chunks; i += 8) {
        const values: unknown[] = [];
        const n = Math.min(8, chunks - i);
        for (let j = 0; j < n; j++)
          values.push(hash, i + j, encoded.slice((i + j) * CHUNK, (i + j + 1) * CHUNK).buffer);
        statements.push(
          this.db
            .prepare(
              'INSERT OR IGNORE INTO app_payload_chunks(hash,ordinal,data,body) VALUES' +
                Array(n).fill("(?,?,?,'')").join(','),
            )
            .bind(...values),
        );
      }
      statements.push(
        this.db.prepare('UPDATE app_payload_objects SET complete=1 WHERE hash=?').bind(hash),
        this.db.prepare('DELETE FROM app_storage_guards WHERE id=?').bind(nonce),
      );
    }
    try {
      const results = await this.db.batch(statements);
      if (results.some((r) => !r.success)) throw Error('Payload transaction failed');
    } catch (error) {
      if (error instanceof StorageMaintenanceError) throw error;
      const capacity = await this.db
        .prepare('SELECT used_bytes FROM app_payload_capacity WHERE id=1')
        .first<{ used_bytes: number }>();
      if (capacity && capacity.used_bytes + encoded.length > CAPACITY)
        throw new StorageCapacityError();
      throw error;
    }
    const verified = await this.get(key);
    if (!verified || (await digest(verified)) !== hash) throw new StorageCapacityError();
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
