import { EditorialDatabase, integer, json, text } from './database';
import { PayloadStore } from './payloads';
export type ArchiveKind = 'job' | 'check' | 'outbox';
const spec = {
  job: {
    table: 'ingestion_jobs',
    time: 'updated_at',
    eligible: "status IN ('DONE','DEAD')",
    id: 'id',
  },
  check: { table: 'source_checks', time: 'attempted_at', eligible: '1=1', id: 'id' },
  outbox: {
    table: 'content_outbox',
    time: 'acknowledged_at',
    eligible: 'acknowledged_at IS NOT NULL',
    id: 'event_id',
  },
} as const;
/** Explicit, bounded, lossless relocation. No scheduler or retention deletion. */
export class ColdRecords {
  readonly payloads: PayloadStore;
  constructor(readonly db: EditorialDatabase) {
    this.payloads = new PayloadStore(db);
  }
  async get(kind: ArchiveKind, id: string): Promise<Record<string, unknown> | null> {
    text(id);
    const s = spec[kind];
    if (!s) throw Error('Invalid cold-record kind');
    const [hot] = await this.db.query<Record<string, unknown>>(
      'archive.hot',
      `SELECT * FROM ${s.table} WHERE ${s.id}=?`,
      [id],
    );
    if (hot) return hot;
    const [entry] = await this.db.query<{ id: string; ordinal: number; payload_json: string }>(
      'archive.read',
      'SELECT a.id,a.ordinal,c.payload_json FROM archive_records a JOIN archive_chunks c ON c.chunk_id=a.chunk_id WHERE a.kind=? AND a.id=?',
      [kind, id],
    );
    if (!entry) return null;
    const rows = JSON.parse(entry.payload_json),
      row = rows[entry.ordinal];
    if (!row || row[s.id] !== id) throw Error('Cold identity verification failed');
    return row;
  }
  async compact(kind: ArchiveKind, cutoff: number, limit = 12): Promise<number> {
    integer(cutoff);
    if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw Error('Cold batch limit is 12');
    const s = spec[kind];
    if (!s) throw Error('Invalid cold-record kind');
    const rows = await this.db.query<Record<string, any>>(
      'archive.select',
      `SELECT * FROM ${s.table} WHERE ${s.eligible} AND ${s.time}<? ORDER BY ${s.time},${s.id} LIMIT ?`,
      [cutoff, limit],
    );
    if (!rows.length) return 0;
    // Refuse oversized packs, preserving the hot data; never truncate records.
    const stored = await this.payloads.store(rows, true),
      verified = await this.payloads.read(stored);
    if (JSON.stringify(verified) !== JSON.stringify(rows))
      throw Error('Cold copy verification failed');
    const random = crypto.getRandomValues(new Uint32Array(2)),
      chunkId = random[0] * 65536 + (random[1] & 65535),
      day = Math.floor(Number(rows[0][s.time]) / 86400000),
      token = crypto.randomUUID();
    const statements = [
      this.db.statement(
        'INSERT INTO archive_chunks(chunk_id,kind,day,payload_json,record_count) VALUES(?,?,?,?,?)',
        [chunkId, kind, day, stored, rows.length],
      ),
    ];
    for (const [ordinal, row] of rows.entries()) {
      statements.push(
        this.db.statement(
          'INSERT INTO archive_records(kind,id,chunk_id,ordinal,dedupe_key) VALUES(?,?,?,?,?)',
          [kind, row[s.id], chunkId, ordinal, kind === 'job' ? row.idempotency_key : null],
        ),
      );
      if (kind === 'check')
        statements.push(
          this.db.statement(
            `INSERT INTO source_check_daily(source_id,day,checks,successes,first_attempt_at,last_attempt_at) VALUES(?,?,1,?,?,?) ON CONFLICT(source_id,day) DO UPDATE SET checks=checks+1,successes=successes+excluded.successes,first_attempt_at=min(first_attempt_at,excluded.first_attempt_at),last_attempt_at=max(last_attempt_at,excluded.last_attempt_at)`,
            [
              row.source_id,
              Math.floor(row.attempted_at / 86400000),
              row.successful,
              row.attempted_at,
              row.attempted_at,
            ],
          ),
        );
      const guard =
        kind === 'job'
          ? ' AND status=? AND updated_at=? AND attempts=?'
          : kind === 'outbox'
            ? ' AND acknowledged_at=?'
            : '';
      const values =
        kind === 'job'
          ? [row.id, row.status, row.updated_at, row.attempts]
          : kind === 'outbox'
            ? [row.event_id, row.acknowledged_at]
            : [row.id];
      statements.push(
        this.db.statement(`DELETE FROM ${s.table} WHERE ${s.id}=?${guard}`, values),
        this.db.guard(`${token}:${ordinal}`),
      );
    }
    statements.push(
      this.db.statement('DELETE FROM transaction_assertions WHERE token LIKE ?', [`${token}:%`]),
    );
    await this.db.batch('archive.commit', statements);
    return rows.length;
  }
}
