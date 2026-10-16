import { EditorialDatabase, json } from './database';
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MARKER = 'dd-editorial-payload-v1';
async function digest(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function streamBytes(bytes: Uint8Array, compress: boolean) {
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(compress ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 2 * 1024 * 1024) throw Error('Editorial payload exceeds codec limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    result.set(chunk, at);
    at += chunk.length;
  }
  return result;
}
/** Immutable content-addressed data. No delete/GC, external service or Node API. */
export class PayloadStore {
  constructor(
    readonly db: EditorialDatabase,
    readonly enabled = true,
  ) {
    db.resolveJson = async (stored) => JSON.stringify(await this.read(stored));
  }
  private async put(bytes: Uint8Array): Promise<string> {
    const key = await digest(bytes);
    const [existing] = await this.db.query<{ hash: string }>(
      'blob.lookup',
      'SELECT hash FROM editorial_blobs WHERE hash=?',
      [key],
    );
    if (existing) return key;
    const compressed = bytes.length > 256 ? await streamBytes(bytes, true) : bytes;
    const zipped = compressed.length + 24 < bytes.length;
    const encoded = zipped ? compressed : bytes;
    // Index B-trees overflow at about 1KB on 4KB pages. Dense fragments avoid
    // allocating a whole overflow page for a slightly larger compressed value.
    const parts =
      encoded.length > 768 && encoded.length <= 20000 ? Math.ceil(encoded.length / 512) : 0;
    const writes = [
      this.db.statement(
        'INSERT INTO editorial_blobs(hash,codec,byte_length,body,fragment_count) VALUES(?,?,?,?,?) ON CONFLICT(hash) DO NOTHING',
        [
          key,
          zipped ? 'gzip' : 'identity',
          bytes.length,
          parts ? new ArrayBuffer(0) : encoded.buffer,
          parts,
        ],
      ),
    ];
    for (let part = 0; part < parts; part++)
      writes.push(
        this.db.statement(
          'INSERT INTO editorial_blob_fragments(hash,part,body) VALUES(?,?,?) ON CONFLICT(hash,part) DO NOTHING',
          [key, part, encoded.slice(part * 512, (part + 1) * 512).buffer],
        ),
      );
    await this.db.batch('blob.put', writes);
    return key;
  }
  private async get(key: string): Promise<Uint8Array> {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid immutable payload reference');
    const [row] = await this.db.query<{
      body: number[] | ArrayBuffer;
      codec: string;
      byte_length: number;
      fragment_count: number;
    }>(
      'blob.read',
      'SELECT body,codec,byte_length,fragment_count FROM editorial_blobs WHERE hash=?',
      [key],
    );
    if (!row) throw Error('Missing immutable editorial payload');
    if (
      !Number.isInteger(row.byte_length) ||
      row.byte_length < 0 ||
      row.byte_length > 2 * 1024 * 1024
    )
      throw Error('Invalid payload size');
    let stored =
      row.body instanceof ArrayBuffer ? new Uint8Array(row.body) : new Uint8Array(row.body);
    if (row.fragment_count) {
      if (
        !Number.isInteger(row.fragment_count) ||
        row.fragment_count < 1 ||
        row.fragment_count > 40
      )
        throw Error('Invalid fragment count');
      const fragments = await this.db.query<{ part: number; body: number[] | ArrayBuffer }>(
        'blob.fragments',
        'SELECT part,body FROM editorial_blob_fragments WHERE hash=? ORDER BY part',
        [key],
      );
      if (fragments.length !== row.fragment_count || fragments.some((x, i) => x.part !== i))
        throw Error('Missing payload fragment');
      const chunks = fragments.map((x) => new Uint8Array(x.body)),
        total = chunks.reduce((sum, x) => sum + x.length, 0);
      stored = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) {
        stored.set(chunk, at);
        at += chunk.length;
      }
    }
    if (!['gzip', 'identity'].includes(row.codec)) throw Error('Unknown immutable payload codec');
    const bytes = row.codec === 'gzip' ? await streamBytes(stored, false) : stored;
    if (bytes.length !== row.byte_length || (await digest(bytes)) !== key)
      throw Error('Editorial payload checksum failed');
    return bytes;
  }
  async store(value: unknown, force = false): Promise<string> {
    const inline = json(value);
    if (
      !this.enabled ||
      (!force && encoder.encode(inline).length < 1024 && (value as any)?.$storage !== MARKER)
    )
      return inline;
    const pack = async (v: unknown): Promise<unknown> => {
      if (typeof v === 'string' && encoder.encode(v).length > 512) {
        const bytes = encoder.encode(v),
          keys: string[] = [];
        for (let at = 0; at < bytes.length; at += 4096)
          keys.push(await this.put(bytes.slice(at, at + 4096)));
        return ['t', bytes.length, keys];
      }
      if (Array.isArray(v)) {
        const result = [];
        for (const item of v) result.push(await pack(item));
        return ['a', result];
      }
      if (v && typeof v === 'object') {
        const pairs = [];
        for (const [k, x] of Object.entries(v)) pairs.push([k, await pack(x)]);
        return ['o', pairs];
      }
      return ['v', v];
    };
    const packed = await pack(JSON.parse(inline)),
      root = await this.put(encoder.encode(JSON.stringify(packed)));
    return JSON.stringify({ $storage: MARKER, root });
  }
  async read<T = unknown>(stored: string): Promise<T> {
    const envelope = JSON.parse(stored);
    if (envelope?.$storage !== MARKER) return envelope as T;
    const memo = new Map<string, Uint8Array>();
    const get = async (key: string) => {
      if (!memo.has(key)) memo.set(key, await this.get(key));
      return memo.get(key)!;
    };
    const unpack = async (v: any): Promise<any> => {
      if (!Array.isArray(v)) throw Error('Invalid editorial codec node');
      if (v[0] === 'v') return v[1];
      if (v[0] === 't') {
        const chunks = [];
        for (const key of v[2]) chunks.push(await get(key));
        const total = chunks.reduce((s, x) => s + x.length, 0);
        if (total !== v[1]) throw Error('Editorial text length failed');
        const joined = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          joined.set(c, offset);
          offset += c.length;
        }
        return decoder.decode(joined);
      }
      if (v[0] === 'a') {
        const result = [];
        for (const x of v[1]) result.push(await unpack(x));
        return result;
      }
      if (v[0] === 'o') {
        const pairs = [];
        for (const [k, x] of v[1]) pairs.push([k, await unpack(x)]);
        return Object.fromEntries(pairs);
      }
      throw Error('Unknown editorial codec node');
    };
    return (await unpack(JSON.parse(decoder.decode(await this.get(envelope.root))))) as T;
  }
}
