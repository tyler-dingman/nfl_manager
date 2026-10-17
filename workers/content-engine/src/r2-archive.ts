import { EditorialDatabase, hash, integer } from './database';
import { PayloadStore } from './payloads';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MAX = 256_000;
const MARKER = 'dd-private-r2-v1';
export async function sha(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
}
async function transform(bytes: Uint8Array, compress: boolean) {
  const reader = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(compress ? new CompressionStream('gzip') : new DecompressionStream('gzip'))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX) throw Error('Archive size limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
/** No public URL, listing, lifecycle or delete operation is exposed. */
export interface PrivateArchiveObjects {
  get(key: string): Promise<Uint8Array | null>;
  putImmutable(key: string, bytes: Uint8Array): Promise<void>;
}
export class LocalR2Objects implements PrivateArchiveObjects {
  reads = 0;
  writes = 0;
  constructor(readonly bucket: R2Bucket) {}
  async get(key: string) {
    this.reads++;
    const o = await this.bucket.get(key);
    if (!o) return null;
    if (o.size > MAX) throw Error('Archive object too large');
    return new Uint8Array(await o.arrayBuffer());
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    const old = await this.get(key);
    if (old) {
      if (old.length !== bytes.length || old.some((v, i) => v !== bytes[i]))
        throw Error('Immutable key collision');
      return;
    }
    this.writes++;
    await this.bucket.put(key, bytes as unknown as ArrayBuffer, {
      onlyIf: { etagDoesNotMatch: '*' },
    });
    const copy = await this.get(key);
    if (!copy || (await sha(copy)) !== (await sha(bytes)))
      throw Error('Object upload verification failed');
  }
}
const specs = {
  revision: {
    table: 'content_candidate_revisions',
    id: 'candidate_id',
    rev: 'revision',
    field: 'record_json',
    eligible: `observed_at<? AND revision<(SELECT max(r.revision) FROM content_candidate_revisions r WHERE r.candidate_id=t.candidate_id) AND NOT EXISTS(SELECT 1 FROM story_evidence e JOIN canonical_stories s ON s.id=e.story_id WHERE e.content_candidate_id=t.candidate_id AND (e.candidate_revision IS NULL OR e.candidate_revision=t.revision) AND s.publication_state IN ('DRAFT','REVIEW','PUBLISHED'))`,
  },
  evidence: {
    table: 'story_evidence',
    id: 'id',
    rev: '0',
    field: 'record_json',
    eligible: `first_seen_at<? AND EXISTS(SELECT 1 FROM canonical_stories s WHERE s.id=t.story_id AND s.publication_state='WITHDRAWN')`,
  },
  version: {
    table: 'story_versions',
    id: 'id',
    rev: 'version',
    field: 'record_json',
    eligible: `created_at<? AND version<(SELECT s.version FROM canonical_stories s WHERE s.id=t.story_id)`,
  },
  candidate: {
    table: 'content_candidates',
    id: 'id',
    rev: '0',
    field: 'record_json',
    eligible: `discovered_at<? AND status IN ('REJECTED','ARCHIVED') AND NOT EXISTS(SELECT 1 FROM ingestion_jobs j WHERE j.candidate_id=t.id AND j.status IN ('PENDING','RUNNING')) AND NOT EXISTS(SELECT 1 FROM story_evidence e JOIN canonical_stories s ON s.id=e.story_id WHERE e.content_candidate_id=t.id AND s.publication_state IN ('DRAFT','REVIEW','PUBLISHED'))`,
  },
  edition: {
    table: 'three_and_out_snapshots',
    id: 'id',
    rev: '0',
    field: 'record_json',
    eligible: `generated_at<? AND status='PUBLISHED' AND generated_at<(SELECT max(e.generated_at) FROM three_and_out_snapshots e WHERE e.team_id=t.team_id AND e.status='PUBLISHED')`,
  },
  job: {
    table: 'ingestion_jobs',
    id: 'id',
    rev: '0',
    field: 'payload_json',
    eligible: `updated_at<? AND status IN ('DONE','DEAD')`,
  },
  check: {
    table: 'source_checks',
    id: 'id',
    rev: '0',
    field: 'record_json',
    eligible: `attempted_at<?`,
  },
  outbox: {
    table: 'content_outbox',
    id: 'event_id',
    rev: 'aggregate_version',
    field: 'payload_json',
    eligible: `acknowledged_at IS NOT NULL AND acknowledged_at<?`,
  },
  operations: {
    table: 'archive_chunks',
    id: 'chunk_id',
    rev: '0',
    field: 'payload_json',
    eligible: `day<?`,
  },
} as const;
export type R2ArchiveKind = keyof typeof specs;
type Member = {
  kind: R2ArchiveKind;
  id: string;
  revision: number;
  value: unknown;
  valueHash: string;
};
type Pointer = {
  $archive: string;
  manifest: string;
  kind: R2ArchiveKind;
  id: string;
  revision: number;
};
/** Explicit local POC operations only. No scheduler or destructive cleanup method. */
export class EditorialR2Archive {
  readonly payloads: PayloadStore;
  constructor(
    readonly db: EditorialDatabase,
    readonly objects: PrivateArchiveObjects,
  ) {
    this.payloads = new PayloadStore(db);
    db.resolveArchive = async (stored) => JSON.stringify(await this.resolve(JSON.parse(stored)));
  }
  async select(kind: R2ArchiveKind, cutoff: number, limit = 8) {
    integer(cutoff);
    if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw Error('Archive batch limit is 8');
    const s = specs[kind];
    if (!s) throw Error('Invalid archive kind');
    return this.db.query<{ id: string; revision: number; original: string }>(
      'r2.select',
      `SELECT CAST(${s.id} AS TEXT) id,${s.rev} revision,${s.field} original FROM ${s.table} t WHERE ${s.eligible} AND ${s.field} NOT LIKE '{"$archive":%' ORDER BY 1,2 LIMIT ?`,
      [cutoff, limit],
      false,
    );
  }
  async archive(
    kind: R2ArchiveKind,
    cutoff: number,
    now: number,
    recoveryMs = 7 * 86400000,
    hook?: () => Promise<void>,
  ) {
    integer(now);
    integer(recoveryMs);
    if (cutoff > (kind === 'operations' ? Math.floor(now / 86400000) : now))
      throw Error('Archive cutoff is in the future');
    const s = specs[kind];
    const rows = await this.select(kind, cutoff);
    if (!rows.length) return null;
    // Selection reads use raw storage for CAS, never the expanding repository decoder.
    const rawRows = rows;
    const members: Member[] = [];
    for (const r of rawRows) {
      const value = await this.payloads.read(r.original);
      members.push({ kind, id: r.id, revision: r.revision, value, valueHash: await hash(value) });
    }
    const raw = encoder.encode(JSON.stringify({ schema: 1, codec: 1, members }));
    if (raw.length > MAX) throw Error('Archive size limit');
    const zipped = await transform(raw, true),
      codec = zipped.length + 24 < raw.length ? 'gzip' : 'identity',
      bytes = codec === 'gzip' ? zipped : raw;
    const objectHash = await sha(bytes),
      rawHash = await sha(raw),
      id = rawHash,
      key = `editorial/v1/${objectHash}.pack`;
    await this.db.batch('r2.prepare', [
      this.db.statement(
        `INSERT INTO r2_archive_manifests(id,object_key,object_hash,raw_hash,codec,schema_version,codec_version,record_count,object_bytes,raw_bytes,state,created_at,recovery_until) VALUES(?,?,?,?,?,1,1,?,?,?,'PREPARED',?,?) ON CONFLICT(id) DO NOTHING`,
        [
          id,
          key,
          objectHash,
          rawHash,
          codec,
          members.length,
          bytes.length,
          raw.length,
          now,
          now + recoveryMs,
        ],
      ),
    ]);
    await this.objects.putImmutable(key, bytes);
    const manifest = await this.manifest(id);
    if (manifest.state !== 'PREPARED') throw Error('Archive attempt is not resumable');
    const verified = await this.unpack(manifest);
    if (JSON.stringify(verified) !== JSON.stringify(members))
      throw Error('Archive member verification failed');
    await hook?.(); // test crash/race injection before the atomic activation boundary
    const statements: D1PreparedStatement[] = [];
    for (const [ordinal, r] of rawRows.entries()) {
      const pointer = JSON.stringify({
        $archive: MARKER,
        manifest: id,
        kind,
        id: r.id,
        revision: r.revision,
      });
      const token = crypto.randomUUID();
      statements.push(
        this.db.statement(
          `UPDATE ${s.table} AS t SET ${s.field}=? WHERE ${s.id}=? AND ${s.rev}=? AND ${s.field}=? AND ${s.eligible}`,
          [pointer, r.id, r.revision, r.original, cutoff],
        ),
        this.db.guard(token),
        this.db.unguard(token),
        this.db.statement(
          `INSERT INTO r2_archive_records(kind,record_id,revision,manifest_id,ordinal,value_hash,original_json,pointer_json) VALUES(?,?,?,?,?,?,?,?)`,
          [kind, r.id, r.revision, id, ordinal, members[ordinal].valueHash, r.original, pointer],
        ),
      );
    }
    const activation = crypto.randomUUID();
    statements.push(
      this.db.statement(
        "UPDATE r2_archive_manifests SET state='ACTIVE',verified_at=? WHERE id=? AND state='PREPARED'",
        [now, id],
      ),
      this.db.guard(activation),
      this.db.unguard(activation),
    );
    await this.db.batch('r2.activate', statements);
    return id;
  }
  async manifest(id: string) {
    const [m] = await this.db.query<any>(
      'r2.manifest',
      'SELECT * FROM r2_archive_manifests WHERE id=?',
      [id],
    );
    if (!m) throw Error('Missing archive manifest');
    return m;
  }
  async unpack(m: any): Promise<Member[]> {
    if (m.schema_version !== 1 || m.codec_version !== 1 || !['identity', 'gzip'].includes(m.codec))
      throw Error('Unsupported archive schema/codec');
    const bytes = await this.objects.get(m.object_key);
    if (!bytes) throw Error('Missing archive object');
    if (bytes.length !== m.object_bytes || (await sha(bytes)) !== m.object_hash)
      throw Error('Archive object checksum failed');
    const raw = m.codec === 'gzip' ? await transform(bytes, false) : bytes;
    if (raw.length !== m.raw_bytes || (await sha(raw)) !== m.raw_hash)
      throw Error('Archive raw checksum failed');
    const pack = JSON.parse(decoder.decode(raw));
    if (
      pack.schema !== 1 ||
      pack.codec !== 1 ||
      !Array.isArray(pack.members) ||
      pack.members.length !== m.record_count
    )
      throw Error('Archive count/schema failed');
    for (const r of pack.members)
      if ((await hash(r.value)) !== r.valueHash) throw Error('Archive value checksum failed');
    return pack.members;
  }
  async resolve(p: Pointer) {
    if (p.$archive !== MARKER || !specs[p.kind]) throw Error('Invalid archive pointer');
    const m = await this.manifest(p.manifest);
    if (m.state !== 'ACTIVE') throw Error('Stale archive pointer');
    const [entry] = await this.db.query<any>(
      'r2.directory',
      'SELECT * FROM r2_archive_records WHERE kind=? AND record_id=? AND revision=? AND manifest_id=?',
      [p.kind, p.id, p.revision, p.manifest],
      false,
    );
    if (!entry) throw Error('Missing archive directory entry');
    const members = await this.unpack(m),
      r = members[entry.ordinal];
    if (
      !r ||
      r.kind !== p.kind ||
      r.id !== p.id ||
      r.revision !== p.revision ||
      r.valueHash !== entry.value_hash
    )
      throw Error('Archive identity verification failed');
    return r.value;
  }
  async restore(id: string, recoveryCopy = false) {
    const m = await this.manifest(id);
    if (m.state === 'RESTORED') return;
    if (m.state !== 'ACTIVE') throw Error('Archive is not active');
    let members: Member[];
    if (recoveryCopy) {
      const entries = await this.db.query<any>(
        'r2.recovery',
        'SELECT * FROM r2_archive_records WHERE manifest_id=? ORDER BY ordinal',
        [id],
        false,
      );
      if (entries.length !== m.record_count) throw Error('Incomplete recovery directory');
      members = [];
      for (const e of entries) {
        if (!e.original_json) throw Error('Recovery copy unavailable');
        const value = await this.payloads.read(e.original_json);
        if ((await hash(value)) !== e.value_hash) throw Error('Recovery copy checksum failed');
        members.push({
          kind: e.kind,
          id: e.record_id,
          revision: e.revision,
          value,
          valueHash: e.value_hash,
        });
      }
    } else members = await this.unpack(m);
    const statements: D1PreparedStatement[] = [];
    for (const r of members) {
      const [entry] = await this.db.query<any>(
        'r2.restore.member',
        'SELECT * FROM r2_archive_records WHERE manifest_id=? AND kind=? AND record_id=? AND revision=?',
        [id, r.kind, r.id, r.revision],
        false,
      );
      if (!entry) throw Error('Missing restore entry');
      const s = specs[r.kind];
      const token = crypto.randomUUID();
      const stored = entry.original_json ?? (await this.payloads.store(r.value, true));
      if ((await hash(await this.payloads.read(stored))) !== r.valueHash)
        throw Error('Restore copy checksum failed');
      statements.push(
        this.db.statement(
          `UPDATE ${s.table} SET ${s.field}=? WHERE ${s.id}=? AND ${s.rev}=? AND ${s.field}=?`,
          [stored, r.id, r.revision, entry.pointer_json],
        ),
        this.db.guard(token),
        this.db.unguard(token),
      );
    }
    statements.push(
      this.db.statement(
        "UPDATE r2_archive_manifests SET state='RESTORED' WHERE id=? AND state='ACTIVE'",
        [id],
      ),
    );
    await this.db.batch('r2.restore', statements);
  }
}
