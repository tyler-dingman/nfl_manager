import { Storage, type SqlDatabase } from './core';
import { D1Objects } from './d1-objects';
import { BoundedD1Objects } from './bounded-d1-objects';
import { instrumentDatabase, requestMetrics, type RequestMetrics } from './instrumentation';

export const TEAM_GROUPS = [
  ['KC', 'DEN', 'LV', 'LAC'],
  ['DAL', 'PHI', 'NYG', 'WAS'],
  ['GB', 'CHI', 'DET', 'MIN'],
  ['SF', 'SEA', 'LAR', 'ARI'],
  ['BUF', 'MIA', 'NE', 'NYJ'],
  ['BAL', 'CIN', 'CLE', 'PIT'],
  ['HOU', 'IND', 'JAX', 'TEN'],
  ['ATL', 'CAR', 'NO', 'TB'],
] as const;
export type DatabaseOwner = 'D1_USERS' | 'D1_SHARED' | `D1_TEAM_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export const DATABASE_OWNERS: readonly DatabaseOwner[] = [
  ...TEAM_GROUPS.map((_, i) => `D1_TEAM_${i + 1}` as DatabaseOwner),
  'D1_USERS',
  'D1_SHARED',
];
export const MAPPING_VERSION = 'nfl-divisions-v1';
export function teamDatabase(team: string): DatabaseOwner {
  if (typeof team !== 'string' || !/^[A-Z]{2,3}$/.test(team))
    throw Error('Explicit canonical team ID required');
  const group = TEAM_GROUPS.findIndex((teams) => (teams as readonly string[]).includes(team));
  if (group < 0) throw Error('Unknown NFL team');
  return `D1_TEAM_${group + 1}` as DatabaseOwner;
}
export class DatabaseOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseOwnershipError';
  }
}
/** Request-scoped router. All ten bindings share one query budget. No distributed transaction API. */
export class MultiD1 {
  readonly metrics: RequestMetrics;
  readonly byOwner = new Map<DatabaseOwner, RequestMetrics>();
  private readonly stores = new Map<DatabaseOwner, Storage>();
  constructor(
    readonly bindings: Partial<Record<DatabaseOwner, SqlDatabase>>,
    metrics = requestMetrics(),
  ) {
    this.metrics = metrics;
    const seen = new Set<SqlDatabase>();
    for (const owner of DATABASE_OWNERS) {
      const db = bindings[owner];
      if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function')
        throw new DatabaseOwnershipError(`Missing database binding: ${owner}`);
      if (seen.has(db)) throw new DatabaseOwnershipError('Database bindings must be distinct');
      seen.add(db);
    }
  }
  storage(owner: DatabaseOwner) {
    if (!DATABASE_OWNERS.includes(owner))
      throw new DatabaseOwnershipError('Unknown database owner');
    let store = this.stores.get(owner);
    if (!store) {
      const local = this.byOwner.get(owner) ?? requestMetrics();
      this.byOwner.set(owner, local);
      // The outer layer reserves the aggregate budget before entering any database.
      const db = instrumentDatabase(
        instrumentDatabase(this.bindings[owner]!, local),
        this.metrics,
        50,
      );
      const raw = this.bindings[owner]!;
      // Bulk preparation spans separate native invocations; keep the final business
      // transaction's 50-statement budget. All payload metadata still counts.
      const objects =
        raw.payloadChunkBytes === undefined
          ? new D1Objects(db)
          : new BoundedD1Objects(
              instrumentDatabase(
                instrumentDatabase(raw, local, undefined, true),
                this.metrics,
                undefined,
                true,
              ),
              raw.payloadChunkBytes,
              db,
              raw.payloadEncoding,
            );
      store = new Storage(db, objects, owner);
      this.stores.set(owner, store);
    }
    return store;
  }
  /** Raw read-only owner/monitoring tooling must still share request accounting. */
  monitoringBindings() {
    return Object.fromEntries(
      DATABASE_OWNERS.map((owner) => {
        const local = this.byOwner.get(owner) ?? requestMetrics();
        this.byOwner.set(owner, local);
        return [
          owner,
          instrumentDatabase(instrumentDatabase(this.bindings[owner]!, local), this.metrics, 50),
        ];
      }),
    ) as Record<DatabaseOwner, SqlDatabase>;
  }
  team(team: string) {
    return this.storage(teamDatabase(team));
  }
  users() {
    return this.storage('D1_USERS');
  }
  shared() {
    return this.storage('D1_SHARED');
  }
}
export type CapacitySample = {
  owner: DatabaseOwner;
  bytes: number;
  previousBytes?: number;
  elapsedDays?: number;
  payloadBytes: number;
  retentionBacklog: number;
};
/** Advisory only. The existing 64 MB encoded-payload admission fence remains unchanged. */
export function capacityStatus(
  samples: CapacitySample[],
  daily: { reads: number; writes: number },
) {
  if (
    samples.length !== 10 ||
    new Set(samples.map((s) => s.owner)).size !== 10 ||
    samples.some(
      (s) =>
        !DATABASE_OWNERS.includes(s.owner) ||
        ![s.bytes, s.payloadBytes, s.retentionBacklog].every((n) => Number.isFinite(n) && n >= 0) ||
        (s.previousBytes !== undefined &&
          (!Number.isFinite(s.previousBytes) || s.previousBytes < 0)) ||
        (s.elapsedDays !== undefined && (!Number.isFinite(s.elapsedDays) || s.elapsedDays <= 0)),
    ) ||
    ![daily.reads, daily.writes].every((n) => Number.isFinite(n) && n >= 0)
  )
    throw Error('Complete valid capacity samples required');
  const totalBytes = samples.reduce((sum, s) => sum + s.bytes, 0);
  return {
    totalBytes,
    accountStorageWarning: totalBytes >= 3_500_000_000,
    accountStorageExceeded: totalBytes >= 5_000_000_000,
    readsWarning: daily.reads >= 3_500_000,
    writesWarning: daily.writes >= 70_000,
    quotaExceeded: daily.reads >= 5_000_000 || daily.writes >= 100_000,
    databases: samples.map((s) => ({
      ...s,
      dailyGrowthBytes:
        s.previousBytes === undefined || s.elapsedDays === undefined
          ? null
          : (s.bytes - s.previousBytes) / s.elapsedDays,
      level:
        s.bytes >= 500_000_000
          ? 'LIMIT'
          : s.bytes >= 450_000_000
            ? 'CRITICAL'
            : s.bytes >= 350_000_000
              ? 'WARNING'
              : 'OK',
      payloadGuardWarning: s.payloadBytes >= 44_800_000,
    })),
  };
}

/** Owner-side monitoring scan with raw bindings. D1 rejects page_count/page_size
 * PRAGMAs; use its returned size_after metadata. Daily totals require analytics.
 * Missing size metadata is an error, never a zero-byte capacity claim. */
export async function collectCapacity(bindings: Partial<Record<DatabaseOwner, SqlDatabase>>) {
  new MultiD1(bindings);
  const samples: CapacitySample[] = [];
  for (const owner of DATABASE_OWNERS) {
    const db = bindings[owner]!;
    const results = await db.batch([
      db.prepare('SELECT 1'),
      db.prepare(
        'SELECT coalesce((SELECT used_bytes FROM app_payload_capacity WHERE id=1),0) AS n',
      ),
      db.prepare(
        "SELECT count(*) AS n FROM app_storage_retention_items i JOIN app_storage_retention_plans p ON p.id=i.run_id WHERE p.state<>'DONE' AND i.ordinal>p.last_ordinal",
      ),
    ]);
    if (results.some((r) => !r.success)) throw Error('Capacity sampling failed');
    const bytes = results[0].meta.size_after;
    if (!Number.isSafeInteger(bytes) || bytes < 1) throw Error('D1 size metadata unavailable');
    samples.push({
      owner,
      bytes,
      payloadBytes: Number(results[1].results[0]?.n),
      retentionBacklog: Number(results[2].results[0]?.n),
    });
  }
  return samples;
}
