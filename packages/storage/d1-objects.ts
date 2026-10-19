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
  /** Bounded encoded prefetch for inline and chunked payloads. Large payloads
   * fall back to individual reads; decode and SHA verification stay lazy. */
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
      const heads = await this.db
        .prepare(
          'SELECT hash,bytes,chunks,inline_data FROM app_payload_objects WHERE hash IN (SELECT value FROM json_each(?)) AND complete=1',
        )
        .bind(JSON.stringify(hashes.slice(i, i + 32)))
        .all<{ hash: string; bytes: number; chunks: number; inline_data: ArrayBuffer | null }>();
      if (!heads.success) throw Error('D1 payload prefetch failed');
      const selected: typeof heads.results = [];
      let reserved = this.encodedBytes;
      for (const head of heads.results)
        if (reserved + head.bytes <= 2_000_000) {
          selected.push(head);
          reserved += head.bytes;
        }
      const chunked = selected.filter((head) => head.inline_data == null);
      const chunks = chunked.length
        ? await this.db
            .prepare(
              'SELECT hash,ordinal,body,data FROM app_payload_chunks WHERE hash IN (SELECT value FROM json_each(?)) ORDER BY hash,ordinal',
            )
            .bind(JSON.stringify(chunked.map((head) => head.hash)))
            .all<{ hash: string; ordinal: number; body: string; data: ArrayBuffer | null }>()
        : { success: true, results: [] };
      if (!chunks.success) throw Error('D1 payload prefetch failed');
      for (const head of selected) {
        let bytes: Uint8Array;
        if (head.inline_data != null) {
          if (head.chunks !== 0) throw Error('Invalid inline payload');
          bytes = new Uint8Array(head.inline_data);
        } else {
          const parts = chunks.results.filter((row) => row.hash === head.hash);
          if (parts.length !== head.chunks) throw Error('Incomplete D1 payload');
          bytes = new Uint8Array(head.bytes);
          let offset = 0;
          for (const [ordinal, row] of parts.entries()) {
            if (row.ordinal !== ordinal) throw Error('Invalid chunk ordering');
            const part =
              row.data == null
                ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
                : new Uint8Array(row.data);
            bytes.set(part, offset);
            offset += part.length;
          }
          if (offset !== head.bytes) throw Error('Invalid chunk length');
        }
        if (bytes.length !== head.bytes) throw Error('Invalid payload length');
        this.encoded.set(objectKey(head.hash), bytes);
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
  /** Bounded inline preparation shares one reservation transaction and batched
   * verification. Legacy/incomplete/chunked objects retain the repair path. */
  async putManyImmutable(entries: { key: string; bytes: Uint8Array }[]) {
    const unique = [...new Map(entries.map((e) => [e.key, e])).values()];
    if (unique.length > 12) throw Error('Editorial preparation exceeds object budget');
    for (const e of unique)
      if (e.key !== objectKey(await digest(e.bytes)) || e.bytes.length > 4_000_000)
        throw Error('Invalid immutable payload');
    await this.prefetch(unique.map((e) => e.key));
    const missing = [];
    for (const e of unique) {
      if (this.verified.has(e.key) || this.encoded.has(e.key)) {
        await this.get(e.key);
        continue;
      }
      const encoded = await encodeObject(e.bytes);
      if (encoded.length > CHUNK || this.incomplete.has(e.key)) {
        await this.putImmutable(e.key, e.bytes);
      } else missing.push({ ...e, encoded, hash: e.key.split('/').at(-1)! });
    }
    if (missing.length) {
      const values: unknown[] = [];
      for (const e of missing) values.push(e.hash, e.encoded.length, e.encoded.slice().buffer);
      const additions = JSON.stringify(
        missing.map((e) => ({ hash: e.hash, bytes: e.encoded.length })),
      );
      const newBytes =
        "(SELECT coalesce(sum(json_extract(j.value,'$.bytes')),0) FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM app_payload_objects o WHERE o.hash=json_extract(j.value,'$.hash')))";
      await this.db.batch([
        this.db.prepare('INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)'),
        this.db
          .prepare(
            'UPDATE app_payload_capacity SET used_bytes=used_bytes+' +
              newBytes +
              ' WHERE id=1 AND used_bytes+' +
              newBytes +
              '<=?',
          )
          .bind(additions, additions, CAPACITY),
        this.db
          .prepare(
            'WITH incoming(hash,bytes,data) AS (VALUES ' +
              missing.map(() => '(?,?,?)').join(',') +
              ') INSERT OR IGNORE INTO app_payload_objects(hash,bytes,inline_data,chunks,complete) SELECT hash,bytes,data,0,1 FROM incoming WHERE changes()=1',
          )
          .bind(...values),
      ]);
      await this.prefetch(missing.map((e) => e.key));
      for (const e of missing) {
        const value = await this.get(e.key);
        if (!value) throw new StorageCapacityError();
        if ((await digest(value)) !== e.hash) throw Error('Editorial object verification failed');
      }
    }
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
