import { EditorialDatabase, hash, integer, text } from './database';
import { sha, type PrivateArchiveObjects } from './r2-archive';
import { teamId } from './teams';
export type Strategy = 'A' | 'B' | 'C';
export interface EditorialDocument {
  kind: string;
  id: string;
  headline: string;
  category: string;
  sourceId: string | null;
  publishedAt: number;
  teamIds: string[];
  payload: unknown;
}
/** Hash payload separately so the original 512KB payload ceiling does not include new metadata. */
export async function editorialDocumentHash(document: EditorialDocument) {
  const { payload, ...metadata } = document;
  return hash({ metadata, payloadHash: await hash(payload) });
}
const MAX_ENVELOPE = 600000;
function envelope(value: unknown) {
  const raw = JSON.stringify(value);
  if (!raw || new TextEncoder().encode(raw).length > MAX_ENVELOPE)
    throw Error('Editorial envelope too large');
  return raw;
}
interface Snapshot {
  schema: 1;
  revision: number;
  document: EditorialDocument;
  previous: string | null;
}
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
/** Local alternative repositories. Caller supplies trusted bindings; no public HTTP/auth changes. */
export class LeanEditorial {
  constructor(
    readonly db: EditorialDatabase,
    readonly objects: PrivateArchiveObjects,
    readonly strategy: Strategy,
  ) {}
  private key(digest: string) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid object hash');
    return `editorial/lean/v1/${digest}.json`;
  }
  private async head(kind: string, id: string) {
    return (
      await this.db.query<any>(
        'lean.head',
        'SELECT * FROM lean_heads WHERE strategy=? AND kind=? AND id=?',
        [this.strategy, kind, id],
        false,
      )
    )[0];
  }
  private async snapshot(digest: string): Promise<Snapshot> {
    const bytes = await this.objects.get(this.key(digest));
    if (!bytes || bytes.length > MAX_ENVELOPE || (await sha(bytes)) !== digest)
      throw Error('Missing/corrupt editorial object');
    const value = JSON.parse(decoder.decode(bytes));
    if (
      value.schema !== 1 ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1 ||
      !value.document ||
      !('payload' in value.document)
    )
      throw Error('Invalid editorial snapshot');
    return value;
  }
  async put(input: EditorialDocument) {
    [input.kind, input.id].forEach(text);
    integer(input.publishedAt);
    if (input.sourceId !== null) text(input.sourceId);
    if (
      typeof input.headline !== 'string' ||
      input.headline.length > 2048 ||
      typeof input.category !== 'string' ||
      input.category.length > 128
    )
      throw Error('Invalid discovery metadata');
    const document: EditorialDocument = {
      ...input,
      teamIds: [...new Set(input.teamIds.map(teamId))].sort(),
    };
    const contentHash = await editorialDocumentHash(document),
      prior = await this.head(document.kind, document.id);
    if (prior?.content_hash === contentHash) return { revision: prior.revision, changed: false };
    const revision = (prior?.revision ?? 0) + 1;
    const snapshot: Snapshot = {
      schema: 1,
      revision,
      document,
      previous: prior?.object_hash ?? null,
    };
    const raw = envelope(snapshot),
      bytes = encoder.encode(raw),
      digest = await sha(bytes);
    await this.objects.putImmutable(this.key(digest), bytes);
    await this.snapshot(digest); // Do not activate a pointer until complete read-back verification.
    const args = [
      this.strategy,
      document.kind,
      document.id,
      revision,
      contentHash,
      digest,
      document.headline,
      document.category,
      document.sourceId,
      document.publishedAt,
    ];
    const token = crypto.randomUUID();
    const statements = [
      this.db.statement(
        prior
          ? 'UPDATE lean_heads SET revision=?,content_hash=?,object_hash=?,headline=?,category=?,source_id=?,published_at=? WHERE strategy=? AND kind=? AND id=? AND revision=?'
          : 'INSERT INTO lean_heads(strategy,kind,id,revision,content_hash,object_hash,headline,category,source_id,published_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        prior
          ? [
              revision,
              contentHash,
              digest,
              document.headline,
              document.category,
              document.sourceId,
              document.publishedAt,
              this.strategy,
              document.kind,
              document.id,
              prior.revision,
            ]
          : args,
      ),
      this.db.guard(token),
    ];
    if (this.strategy !== 'C')
      statements.push(
        this.db.statement(
          'INSERT INTO lean_versions(strategy,kind,id,revision,object_hash,headline,category,source_id,published_at,inline_json) VALUES(?,?,?,?,?,?,?,?,?,?)',
          [
            this.strategy,
            document.kind,
            document.id,
            revision,
            digest,
            document.headline,
            document.category,
            document.sourceId,
            document.publishedAt,
            this.strategy === 'B' ? raw : null,
          ],
        ),
      );
    statements.push(
      this.db.statement('DELETE FROM lean_teams WHERE strategy=? AND kind=? AND id=?', [
        this.strategy,
        document.kind,
        document.id,
      ]),
    );
    // At most 80 bind parameters/query; national records stay below invocation query limits.
    for (let at = 0; at < document.teamIds.length; at += 16) {
      const teams = document.teamIds.slice(at, at + 16);
      statements.push(
        this.db.statement(
          `INSERT INTO lean_teams(strategy,kind,id,team_id,published_at) VALUES ${teams.map(() => '(?,?,?,?,?)').join(',')}`,
          teams.flatMap((team) => [
            this.strategy,
            document.kind,
            document.id,
            team,
            document.publishedAt,
          ]),
        ),
      );
    }
    statements.push(this.db.unguard(token));
    try {
      await this.db.batch('lean.commit', statements);
    } catch (error) {
      const winner = await this.head(document.kind, document.id);
      if (winner?.content_hash === contentHash)
        return { revision: winner.revision, changed: false };
      throw error;
    }
    return { revision, changed: true };
  }
  /** Terminal operational history only. Active jobs/leases remain in their original queue. */
  async receipt(kind: string, id: string, dedupeKey: string, payload: unknown) {
    [kind, id, dedupeKey].forEach(text);
    const [prior] = await this.db.query<any>(
      'lean.receipt.lookup',
      'SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND id=? UNION ALL SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND dedupe_key=?',
      [this.strategy, kind, id, this.strategy, kind, dedupeKey],
      false,
    );
    const bytes = encoder.encode(envelope({ schema: 1, kind, id, dedupeKey, payload })),
      digest = await sha(bytes);
    if (prior) {
      if (prior.object_hash !== digest) throw Error('Operational receipt identity conflict');
      return false;
    }
    await this.objects.putImmutable(this.key(digest), bytes);
    const verified = await this.objects.get(this.key(digest));
    if (!verified || (await sha(verified)) !== digest) throw Error('Receipt verification failed');
    await this.db.batch('lean.receipt.commit', [
      this.db.statement(
        'INSERT INTO lean_receipts(strategy,kind,id,dedupe_key,object_hash) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',
        [this.strategy, kind, id, dedupeKey, digest],
      ),
    ]);
    const [winner] = await this.db.query<any>(
      'lean.receipt.verify',
      'SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND id=? UNION ALL SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND dedupe_key=?',
      [this.strategy, kind, id, this.strategy, kind, dedupeKey],
      false,
    );
    if (winner?.object_hash !== digest || winner.id !== id)
      throw Error('Operational receipt identity conflict');
    return true;
  }
  async readReceipt(kind: string, id: string) {
    const [row] = await this.db.query<any>(
      'lean.receipt.read',
      'SELECT object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND id=?',
      [this.strategy, kind, id],
      false,
    );
    if (!row) return null;
    const bytes = await this.objects.get(this.key(row.object_hash));
    if (!bytes || (await sha(bytes)) !== row.object_hash) throw Error('Missing/corrupt receipt');
    const value = JSON.parse(decoder.decode(bytes));
    if (value.kind !== kind || value.id !== id) throw Error('Receipt identity mismatch');
    return value.payload;
  }
  async get(kind: string, id: string, revision?: number): Promise<EditorialDocument | null> {
    const head = await this.head(kind, id);
    if (!head) return null;
    const target = revision ?? head.revision;
    integer(target);
    if (target < 1 || target > head.revision) return null;
    let digest = head.object_hash;
    if (this.strategy !== 'C') {
      const [row] = await this.db.query<any>(
        'lean.version',
        'SELECT * FROM lean_versions WHERE strategy=? AND kind=? AND id=? AND revision=?',
        [this.strategy, kind, id, target],
        false,
      );
      if (!row) throw Error('Missing editorial version');
      if (row.inline_json) {
        const snapshot = JSON.parse(row.inline_json);
        if ((await sha(encoder.encode(row.inline_json))) !== row.object_hash)
          throw Error('Corrupt hot copy');
        return snapshot.document;
      }
      digest = row.object_hash;
    }
    for (let hops = 0; hops < 50; hops++) {
      const snapshot = await this.snapshot(digest);
      if (snapshot.document.kind !== kind || snapshot.document.id !== id)
        throw Error('Editorial identity mismatch');
      if (snapshot.revision === target) return snapshot.document;
      if (snapshot.revision < target || !snapshot.previous) throw Error('Broken editorial history');
      digest = snapshot.previous;
    }
    throw Error('History traversal exceeds invocation budget; use indexed strategy A');
  }
  async feed(team: string, kind: string, limit = 20, cursor?: { time: number; id: string }) {
    teamId(team);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw Error('Invalid feed budget');
    const rows = await this.db.query<any>(
      'lean.feed',
      `SELECT h.* FROM lean_teams t JOIN lean_heads h ON h.strategy=t.strategy AND h.kind=t.kind AND h.id=t.id WHERE t.strategy=? AND t.team_id=? AND t.kind=? AND (t.published_at,t.id)<(?,?) ORDER BY t.published_at DESC,t.id DESC LIMIT ?`,
      [
        this.strategy,
        team,
        kind,
        cursor?.time ?? Number.MAX_SAFE_INTEGER,
        cursor?.id ?? '\uffff',
        limit + 1,
      ],
      false,
    );
    const more = rows.length > limit,
      items = rows.slice(0, limit);
    const last = items.at(-1);
    // Metadata feed avoids N+1 body reads. Detail and full legacy adapters resolve separately.
    return { items, nextCursor: more && last ? { time: last.published_at, id: last.id } : null };
  }
  /** Hydrate a complete legacy-compatible payload page with one metadata query and <=20 object reads. */
  async fullFeed(team: string, kind: string, limit = 20, cursor?: { time: number; id: string }) {
    const page = await this.feed(team, kind, limit, cursor),
      items: unknown[] = [];
    for (let at = 0; at < page.items.length; at += 4) {
      const resolved = await Promise.all(
        page.items.slice(at, at + 4).map(async (row) => {
          const snapshot = await this.snapshot(row.object_hash);
          if (
            snapshot.document.kind !== row.kind ||
            snapshot.document.id !== row.id ||
            snapshot.revision !== row.revision
          )
            throw Error('Feed identity mismatch');
          return snapshot.document.payload;
        }),
      );
      items.push(...resolved);
    }
    return { items, nextCursor: page.nextCursor };
  }
  async history(sourceId: string, limit = 20) {
    if (this.strategy === 'C') throw Error('R2-first lacks indexed historical discovery');
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw Error('Invalid history budget');
    return this.db.query<any>(
      'lean.history',
      'SELECT kind,id,revision,headline,category,published_at FROM lean_versions WHERE strategy=? AND source_id=? ORDER BY published_at DESC,kind,id,revision LIMIT ?',
      [this.strategy, sourceId, limit],
      false,
    );
  }
  async retireHot(cutoff: number, limit = 8) {
    integer(cutoff);
    if (!Number.isInteger(limit) || limit < 1 || limit > 8)
      throw Error('Invalid retirement budget');
    const rows = await this.db.query<any>(
      'lean.hot.select',
      'SELECT * FROM lean_versions WHERE strategy=? AND published_at<? AND inline_json IS NOT NULL ORDER BY published_at,kind,id,revision LIMIT ?',
      [this.strategy, cutoff, limit],
      false,
    );
    for (const row of rows) {
      const snapshot = await this.snapshot(row.object_hash);
      if (JSON.stringify(snapshot) !== row.inline_json) throw Error('Hot retirement mismatch');
    }
    if (rows.length)
      await this.db.batch(
        'lean.hot.retire',
        rows.map((r) =>
          this.db.statement(
            'UPDATE lean_versions SET inline_json=NULL WHERE strategy=? AND kind=? AND id=? AND revision=? AND object_hash=? AND inline_json=?',
            [this.strategy, r.kind, r.id, r.revision, r.object_hash, r.inline_json],
          ),
        ),
      );
    return rows.length;
  }
  /** Explicit repair of missing immutable bytes, only if an exact verified B hot copy survives. */
  async repairHot(kind: string, id: string, revision: number) {
    const [row] = await this.db.query<any>(
      'lean.hot.repair',
      'SELECT object_hash,inline_json FROM lean_versions WHERE strategy=? AND kind=? AND id=? AND revision=?',
      [this.strategy, kind, id, revision],
      false,
    );
    if (!row?.inline_json || (await sha(encoder.encode(row.inline_json))) !== row.object_hash)
      throw Error('Verified hot recovery copy unavailable');
    await this.objects.putImmutable(this.key(row.object_hash), encoder.encode(row.inline_json));
    await this.snapshot(row.object_hash);
  }
}
/** Separate from legacy 256KB packs; validates the 512KB legacy payload plus bounded snapshot-envelope overhead. */
export class LeanR2Objects implements PrivateArchiveObjects {
  reads = 0;
  writes = 0;
  bytesWritten = 0;
  constructor(readonly bucket: R2Bucket) {}
  async get(key: string) {
    this.reads++;
    const object = await this.bucket.get(key);
    if (!object) return null;
    if (object.size > MAX_ENVELOPE) throw Error('Oversized lean object');
    return new Uint8Array(await object.arrayBuffer());
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    if (bytes.length > MAX_ENVELOPE) throw Error('Oversized lean object');
    const prior = await this.get(key);
    if (prior) {
      if ((await sha(prior)) !== (await sha(bytes))) throw Error('Immutable object conflict');
      return;
    }
    this.writes++;
    this.bytesWritten += bytes.length;
    await this.bucket.put(key, bytes as unknown as ArrayBuffer, {
      onlyIf: { etagDoesNotMatch: '*' },
    });
    const copy = await this.get(key);
    if (!copy || (await sha(copy)) !== (await sha(bytes)))
      throw Error('Object upload verification failed');
  }
}
