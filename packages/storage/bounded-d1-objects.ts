import { Buffer } from 'node:buffer';
import { digest, objectKey, type Objects, type SqlDatabase, type Statement } from './core';
import { encodeObject, decodeObject } from './codec';
import { writeFencedDatabase } from './write-fence';

const PHYSICAL = 48000;
const CAPACITY = 64000000;
type Head = { bytes: number; chunks: number; complete: number; inline: number };
type Manifest = {
  hash: string;
  bytes: number;
  encoded_hash: string;
  block_bytes: number;
  offset: number;
  done: number;
};
/** Server-side continuation of immutable preparation, NOT a business transaction.
 * Each step is one native fenced batch. Render verifies every durable byte and
 * original SHA before publication. No browser-supplied SQL or completion flag.
 * Existing objects/chunks remain the recovery/GC format; only progress is new.
 */
export class BoundedD1Objects implements Objects {
  readonly compactTrees = true;
  private readonly verified = new Map<string, Uint8Array>();
  private cachedBytes = 0;
  private remember(key: string, bytes: Uint8Array) {
    if (!this.verified.has(key) && this.cachedBytes + bytes.length <= 8000000) {
      this.verified.set(key, bytes.slice());
      this.cachedBytes += bytes.length;
    }
  }
  readonly db: SqlDatabase;
  private readonly businessDb: SqlDatabase;
  constructor(
    raw: SqlDatabase,
    readonly blockBytes: number,
    businessDb?: SqlDatabase,
    readonly encoding?: 'hex',
  ) {
    if (![4096, 8192, 16384, 32768, 65536].includes(blockBytes)) throw Error('Invalid block size');
    const fence = {};
    if (encoding !== undefined && encoding !== 'hex') throw Error('Invalid payload transport');
    this.db = writeFencedDatabase(raw, fence);
    this.businessDb = writeFencedDatabase(businessDb ?? raw, fence);
  }
  transactionDatabase(db: SqlDatabase) {
    return this.businessDb ?? this.db;
  }
  private hash(key: string) {
    const hash = key.split('/').at(-1)!;
    if (key !== objectKey(hash)) throw Error('Invalid immutable key');
    return hash;
  }
  private async head(hash: string) {
    return this.db
      .prepare(
        'SELECT bytes,chunks,complete,inline_data IS NOT NULL AS inline FROM app_payload_objects WHERE hash=?',
      )
      .bind(hash)
      .first<Head>();
  }
  private async manifest(hash: string) {
    return this.db
      .prepare(
        'SELECT hash,bytes,encoded_hash,block_bytes,offset,done FROM app_payload_uploads WHERE hash=?',
      )
      .bind(hash)
      .first<Manifest>();
  }
  private guard(sql: string, values: unknown[], token: string): Statement {
    return this.db
      .prepare(
        'INSERT INTO app_storage_guards(id,ok) SELECT ?,CASE WHEN ' + sql + ' THEN 1 ELSE 0 END',
      )
      .bind(token, ...values);
  }
  private async atomic(statements: Statement[], token: string) {
    const results = await this.db.batch([
      ...statements,
      this.db.prepare('DELETE FROM app_storage_guards WHERE id LIKE ?').bind(token + '%'),
    ]);
    if (results.some((r) => !r.success)) throw Error('Payload atomic step failed');
    return results;
  }
  private validate(head: Head) {
    if (
      !Number.isInteger(head.bytes) ||
      head.bytes < 0 ||
      head.bytes > 4000000 ||
      head.chunks !== (head.inline ? 0 : Math.ceil(head.bytes / PHYSICAL))
    )
      throw Error('Corrupt payload manifest');
  }
  /** Each result carries at most one bounded BLOB. Legacy base64 chunks are
   * sliced in base64 groups so old archives also avoid unbounded responses. */
  private fromHex(value: unknown, length: number) {
    if (typeof value !== 'string' || value.length !== length * 2 || !/^[0-9a-f]*$/i.test(value))
      throw Error('Corrupt binary transport');
    return new Uint8Array(Buffer.from(value, 'hex'));
  }
  private async stored(hash: string, head: Head) {
    this.validate(head);
    const bytes = new Uint8Array(head.bytes);
    for (let offset = 0; offset < head.bytes; ) {
      const ordinal = Math.floor(offset / PHYSICAL),
        local = offset % PHYSICAL;
      const length = Math.min(
        this.blockBytes,
        head.bytes - offset,
        head.inline ? this.blockBytes : PHYSICAL - local,
      );
      let part: Uint8Array;
      if (head.inline) {
        const row = await this.db
          .prepare(
            `SELECT ${this.encoding ? 'hex(substr(inline_data,?,?))' : 'substr(inline_data,?,?)'} AS data FROM app_payload_objects WHERE hash=?`,
          )
          .bind(offset + 1, length, hash)
          .first<{ data: ArrayBuffer | number[] }>();
        if (!row) throw Error('Missing payload');
        part = this.encoding
          ? this.fromHex(row.data, length)
          : new Uint8Array(row.data as ArrayBuffer);
      } else {
        const start = Math.floor(local / 3) * 4,
          end = Math.ceil((local + length) / 3) * 4;
        const row = await this.db
          .prepare(
            `SELECT ${this.encoding ? 'CASE WHEN data IS NULL THEN NULL ELSE hex(substr(data,?,?)) END' : 'substr(data,?,?)'} AS data,CASE WHEN data IS NULL THEN substr(body,?,?) ELSE NULL END AS body FROM app_payload_chunks WHERE hash=? AND ordinal=?`,
          )
          .bind(local + 1, length, start + 1, end - start, hash, ordinal)
          .first<{ data: ArrayBuffer | number[] | null; body: string | null }>();
        if (!row) throw Error('Missing chunk');
        part =
          row.data === null
            ? Uint8Array.from(atob(row.body!), (c) => c.charCodeAt(0)).slice(
                local % 3,
                (local % 3) + length,
              )
            : this.encoding
              ? this.fromHex(row.data, length)
              : new Uint8Array(row.data as ArrayBuffer);
      }
      if (part.length !== length) throw Error('Truncated payload');
      bytes.set(part, offset);
      offset += length;
    }
    return bytes;
  }
  async get(key: string) {
    const hash = this.hash(key);
    const cached = this.verified.get(key);
    if (cached) return cached.slice();
    const head = await this.head(hash);
    if (!head || head.complete !== 1) return null;
    const bytes = await decodeObject(await this.stored(hash, head), hash);
    this.remember(key, bytes);
    return bytes.slice();
  }
  async prefetch(_keys: string[]) {
    /* Bounded lazy reads; no bulk BLOB result. */
  }
  async putManyImmutable(entries: { key: string; bytes: Uint8Array }[]) {
    if (entries.length > 12) throw Error('Editorial preparation exceeds object budget');
    for (const entry of entries) await this.putImmutable(entry.key, entry.bytes);
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    const hash = this.hash(key);
    if (bytes.length > 4000000 || (await digest(bytes)) !== hash)
      throw Error('Invalid immutable payload');
    const head = await this.head(hash);
    if (head?.complete) {
      await this.get(key);
      return;
    }
    const encoded = await encodeObject(bytes),
      encodedHash = await digest(encoded);
    const chunks = Math.ceil(encoded.length / PHYSICAL);
    // Preserve the existing atomic inline path for tiny metadata/receipts.
    // Chunk continuation is for large payloads; forcing every tiny object through
    // manifests increases nonce writes without reducing a meaningful CPU cost.
    if (!head && encoded.length <= 4096) {
      const t = crypto.randomUUID();
      const inlineResults = await this.atomic(
        [
          this.db.prepare('INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)'),
          this.db
            .prepare(
              `INSERT OR IGNORE INTO app_payload_objects(hash,bytes,chunks,complete,inline_data) SELECT ?,?,0,1,${this.encoding ? 'unhex(?)' : '?'} WHERE (SELECT used_bytes FROM app_payload_capacity WHERE id=1)+?<=?`,
            )
            .bind(
              hash,
              encoded.length,
              this.encoding ? Buffer.from(encoded).toString('hex') : encoded.slice().buffer,
              encoded.length,
              CAPACITY,
            ),
          this.db
            .prepare(
              'UPDATE app_payload_capacity SET used_bytes=used_bytes+? WHERE id=1 AND changes()=1',
            )
            .bind(encoded.length),
          this.guard(
            'EXISTS(SELECT 1 FROM app_payload_objects WHERE hash=? AND bytes=? AND complete=1)',
            [hash, encoded.length],
            t,
          ),
          this.db
            .prepare(
              `SELECT ${this.encoding ? 'hex(inline_data)' : 'inline_data'} AS data FROM app_payload_objects WHERE hash=? AND complete=1 AND inline_data IS NOT NULL`,
            )
            .bind(hash),
        ],
        t,
      );
      const returned = inlineResults.at(-2)?.results[0]?.data;
      const durable =
        returned == null
          ? await this.get(key)
          : await decodeObject(
              this.encoding
                ? this.fromHex(returned, encoded.length)
                : new Uint8Array(returned as ArrayBuffer),
              hash,
            );
      if (!durable || (await digest(durable)) !== hash)
        throw Error('Inline full SHA verification failed');
      this.remember(key, durable);
      return;
    }
    let progress = await this.manifest(hash);
    if (!progress) {
      if (head) throw Error('Legacy interrupted payload preserved; owner reconciliation required');
      const t = crypto.randomUUID();
      await this.atomic(
        [
          this.db.prepare('INSERT OR IGNORE INTO app_payload_capacity(id,used_bytes) VALUES(1,0)'),
          this.db
            .prepare(
              'INSERT OR IGNORE INTO app_payload_objects(hash,bytes,chunks,complete,inline_data) SELECT ?,?,?,0,NULL WHERE (SELECT used_bytes FROM app_payload_capacity WHERE id=1)+?<=?',
            )
            .bind(hash, encoded.length, chunks, encoded.length, CAPACITY),
          this.db
            .prepare(
              'INSERT INTO app_payload_uploads(hash,bytes,encoded_hash,block_bytes,offset,done) SELECT ?,?,?,?,0,0 WHERE changes()=1',
            )
            .bind(hash, encoded.length, encodedHash, this.blockBytes),
          this.db
            .prepare(
              'UPDATE app_payload_capacity SET used_bytes=used_bytes+? WHERE id=1 AND changes()=1',
            )
            .bind(encoded.length),
          this.guard(
            'EXISTS(SELECT 1 FROM app_payload_uploads WHERE hash=? AND bytes=? AND encoded_hash=?)',
            [hash, encoded.length, encodedHash],
            t,
          ),
        ],
        t,
      );
      progress = await this.manifest(hash);
    }
    if (
      !progress ||
      progress.bytes !== encoded.length ||
      progress.encoded_hash !== encodedHash ||
      ![4096, 8192, 16384, 32768, 65536].includes(progress.block_bytes) ||
      !Number.isInteger(progress.offset) ||
      progress.offset < 0 ||
      progress.offset > encoded.length ||
      (progress.offset !== encoded.length && progress.offset % progress.block_bytes !== 0)
    )
      throw Error('Corrupt/incompatible upload manifest');
    // Resume verifies the exact durable prefix and chunk receipts. A lost mutation
    // response escapes immediately; only a subsequent explicit call resumes.
    for (let offset = 0; offset < progress.offset; offset += progress.block_bytes) {
      const part = encoded.slice(offset, Math.min(offset + progress.block_bytes, encoded.length));
      const receipt = await this.db
        .prepare('SELECT part_hash,bytes FROM app_payload_upload_parts WHERE hash=? AND offset=?')
        .bind(hash, offset)
        .first<{ part_hash: string; bytes: number }>();
      if (!receipt || receipt.bytes !== part.length || receipt.part_hash !== (await digest(part)))
        throw Error('Corrupt chunk receipt');
    }
    for (let offset = progress.offset; offset < encoded.length; offset += progress.block_bytes) {
      const part = encoded.slice(offset, offset + progress.block_bytes),
        partHash = await digest(part),
        t = crypto.randomUUID();
      const statements: Statement[] = [
        this.guard(
          'EXISTS(SELECT 1 FROM app_payload_uploads WHERE hash=? AND offset=? AND done=0 AND bytes=? AND encoded_hash=?)',
          [hash, offset, encoded.length, encodedHash],
          t,
        ),
      ];
      for (let at = 0; at < part.length; ) {
        const absolute = offset + at,
          ordinal = Math.floor(absolute / PHYSICAL),
          within = absolute % PHYSICAL,
          n = Math.min(part.length - at, PHYSICAL - within);
        statements.push(
          this.db
            .prepare(
              `INSERT INTO app_payload_chunks(hash,ordinal,data,body) SELECT ?,?,${this.encoding ? 'unhex(?)' : '?'},'' WHERE ?=0 OR EXISTS(SELECT 1 FROM app_payload_chunks WHERE hash=? AND ordinal=? AND length(data)=?) ON CONFLICT(hash,ordinal) DO UPDATE SET data=CAST(app_payload_chunks.data||excluded.data AS BLOB) WHERE length(app_payload_chunks.data)=?`,
            )
            .bind(
              hash,
              ordinal,
              this.encoding
                ? Buffer.from(part.subarray(at, at + n)).toString('hex')
                : part.slice(at, at + n).buffer,
              within,
              hash,
              ordinal,
              within,
              within,
            ),
        );
        statements.push(this.guard('changes()=1', [], t + '-' + at));
        at += n;
      }
      statements.push(
        this.db
          .prepare(
            'INSERT INTO app_payload_upload_parts(hash,offset,bytes,part_hash) VALUES(?,?,?,?)',
          )
          .bind(hash, offset, part.length, partHash),
        this.db
          .prepare('UPDATE app_payload_uploads SET offset=? WHERE hash=? AND offset=? AND done=0')
          .bind(offset + part.length, hash, offset),
      );
      try {
        await this.atomic(statements, t);
      } catch (error) {
        // Concurrent identical preparation may win. Read-only reconciliation is
        // allowed; never dispatch the ambiguous mutation a second time.
        const receipt = await this.db
          .prepare('SELECT part_hash,bytes FROM app_payload_upload_parts WHERE hash=? AND offset=?')
          .bind(hash, offset)
          .first<{ part_hash: string; bytes: number }>();
        if (!receipt || receipt.part_hash !== partHash || receipt.bytes !== part.length)
          throw error;
        // An unknown transport outcome remains an error even with a receipt:
        // the caller must explicitly resume under the original business ID.
        if ((error as Error).name === 'NativeBoundaryError') throw error;
      }
    }
    const current = await this.head(hash);
    if (!current) throw Error('Missing upload');
    const stored = await this.stored(hash, current);
    if (
      (await digest(stored)) !== encodedHash ||
      (await digest(await decodeObject(stored, hash))) !== hash
    )
      throw Error('Upload full SHA verification failed');
    const t = crypto.randomUUID();
    await this.atomic(
      [
        this.guard(
          'EXISTS(SELECT 1 FROM app_payload_uploads WHERE hash=? AND offset=bytes AND bytes=? AND encoded_hash=?) AND (SELECT count(*) FROM app_payload_chunks WHERE hash=?)=? AND (SELECT coalesce(sum(length(data)),0) FROM app_payload_chunks WHERE hash=?)=?',
          [hash, encoded.length, encodedHash, hash, chunks, hash, encoded.length],
          t,
        ),
        this.db
          .prepare(
            'UPDATE app_payload_objects SET complete=1 WHERE hash=? AND bytes=? AND chunks=?',
          )
          .bind(hash, encoded.length, chunks),
        this.db
          .prepare('UPDATE app_payload_uploads SET done=1 WHERE hash=? AND offset=bytes')
          .bind(hash),
      ],
      t,
    );
    this.remember(key, bytes);
  }
}
