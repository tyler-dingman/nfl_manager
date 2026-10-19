import { decodeObject } from './codec';
import { JsonTree } from './json-tree';
export interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{
    success: boolean;
    results: T[];
    meta: Record<string, number>;
  }>;
  run(): Promise<{
    success: boolean;
    results: Record<string, unknown>[];
    meta: Record<string, number>;
  }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface SqlDatabase {
  prepare(sql: string): Statement;
  batch(
    statements: Statement[],
  ): Promise<
    { success: boolean; results: Record<string, unknown>[]; meta: Record<string, number> }[]
  >;
}
export interface Objects {
  get(key: string): Promise<Uint8Array | null>;
  putImmutable(key: string, bytes: Uint8Array): Promise<void>;
}
export const utf8 = new TextEncoder();
export const decode = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
export async function digest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
}
export const objectKey = (hash: string) => {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('Invalid immutable hash');
  return `application/v1/${hash}`;
};
export class Storage {
  constructor(
    readonly db: SqlDatabase,
    readonly objects: Objects,
  ) {}
  statement(sql: string, values: unknown[] = []) {
    if (values.length > 100) throw Error('SQL parameter budget exceeded');
    return this.db.prepare(sql).bind(...values);
  }
  async rows<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
    const r = await this.statement(sql, values).all<T>();
    if (!r.success) throw Error('D1 query failed');
    return r.results;
  }
  async batch(statements: Statement[]) {
    if (statements.length > 50) throw Error('D1 batch budget exceeded');
    const r = await this.db.batch(statements);
    if (r.some((x) => !x.success)) throw Error('D1 batch failed');
    return r;
  }
  async put(value: unknown) {
    const bytes = utf8.encode(JSON.stringify(value));
    if (bytes.length > 4_000_000)
      throw Error('Application object exceeds 4 MB; use offline chunked import');
    const hash = await digest(bytes),
      key = objectKey(hash);
    await this.objects.putImmutable(key, bytes);
    const verified = await this.objects.get(key);
    if (!verified || (await digest(verified)) !== hash)
      throw Error('Object read-back verification failed');
    return hash;
  }
  async get<T = unknown>(hash: string): Promise<T> {
    const stored = await this.objects.get(objectKey(hash));
    if (!stored) throw Error('Missing or corrupt application object');
    let bytes: Uint8Array;
    try {
      bytes = await decodeObject(stored, hash);
    } catch {
      throw Error('Missing or corrupt application object');
    }
    return JSON.parse(decode.decode(bytes)) as T;
  }
  guard(nonce: string) {
    return this.statement('INSERT INTO app_assertions(nonce,ok) VALUES(?,changes())', [nonce]);
  }
  unguard(nonce: string) {
    return this.statement('DELETE FROM app_assertions WHERE nonce=?', [nonce]);
  }
}
/** An owner-scoped aggregate commit. R2 is verified before the atomic head/receipt CAS.
 * No promise of a multi-owner or cross-database transaction is made. */
export class ApplicationDocuments {
  constructor(readonly storage: Storage) {}
  async read<T>(owner: string, kind: string, id: string) {
    const [head] = await this.storage.rows<{ revision: number; object_hash: string }>(
      'SELECT revision,object_hash FROM app_heads WHERE owner_id=? AND kind=? AND id=?',
      [owner, kind, id],
    );
    if (!head) return null;
    const envelope = await this.storage.get<{
      schema: number;
      root?: string;
      owner: string;
      kind: string;
      id: string;
      revision: number;
      value: T;
    }>(head.object_hash);
    if (
      ![1, 2].includes(envelope.schema) ||
      envelope.owner !== owner ||
      envelope.kind !== kind ||
      envelope.id !== id ||
      envelope.revision !== head.revision
    )
      throw Error('Application envelope identity mismatch');
    const value =
      envelope.schema === 2
        ? await new JsonTree(this.storage).get<T>(envelope.root!)
        : envelope.value;
    return { revision: head.revision, value };
  }
  async commit(
    owner: string,
    kind: string,
    id: string,
    expected: number,
    command: string,
    value: unknown,
  ) {
    if (
      !owner ||
      !kind ||
      !id ||
      command.length < 8 ||
      !Number.isSafeInteger(expected) ||
      expected < 0
    )
      throw Error('Invalid application command');
    const requestHash = await digest(utf8.encode(JSON.stringify({ kind, id, expected, value })));
    const [prior] = await this.storage.rows<{
      request_hash: string;
      revision: number;
      object_hash: string;
    }>(
      'SELECT request_hash,revision,object_hash FROM app_receipts WHERE owner_id=? AND command_id=?',
      [owner, command],
    );
    if (prior) {
      if (prior.request_hash !== requestHash) throw Error('Command identity conflict');
      return { revision: prior.revision, replayed: true };
    }
    const hash = await this.storage.put({
        schema: 2,
        owner,
        kind,
        id,
        revision: expected + 1,
        root: await new JsonTree(this.storage).put(value),
      }),
      nonce = crypto.randomUUID();
    const write =
      expected === 0
        ? this.storage.statement(
            'INSERT INTO app_heads(owner_id,kind,id,revision,object_hash,updated_at) VALUES(?,?,?,?,?,?)',
            [owner, kind, id, 1, hash, Date.now()],
          )
        : this.storage.statement(
            'UPDATE app_heads SET revision=revision+1,object_hash=?,updated_at=? WHERE owner_id=? AND kind=? AND id=? AND revision=?',
            [hash, Date.now(), owner, kind, id, expected],
          );
    await this.storage.batch([
      write,
      this.storage.guard(nonce),
      this.storage.statement(
        'INSERT INTO app_receipts(owner_id,command_id,request_hash,kind,id,revision,object_hash) VALUES(?,?,?,?,?,?,?)',
        [owner, command, requestHash, kind, id, expected + 1, hash],
      ),
      this.storage.unguard(nonce),
    ]);
    return { revision: expected + 1, replayed: false };
  }
}
