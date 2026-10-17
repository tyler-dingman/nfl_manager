import { createHash } from 'node:crypto';
import { z } from 'zod';
import { TEAM_LIST } from '@/data/teams';
import type { SaveState } from '@/server/api/store';

export const STATE_SCHEMA_VERSION = 1;
export const migrationStatuses = [
  'LEGACY_COMPLETE',
  'LEGACY_PARTIAL',
  'RECONCILIATION_REQUIRED',
  'MIGRATED',
  'MIGRATION_FAILED',
] as const;
export type MigrationStatus = (typeof migrationStatuses)[number];
export type ReferenceBundle = Record<string, Record<string, unknown>>;
export type DurableWorkspace = { runtime: SaveState; trades: Array<[string, unknown]> };
export const stableJson = (value: unknown): string => JSON.stringify(canonical(value));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const checksum = (value: unknown) =>
  createHash('sha256').update(stableJson(value)).digest('hex');
const player = z
  .object({
    id: z.string().min(1),
    firstName: z.string(),
    lastName: z.string(),
    position: z.string().min(1),
    contractYearsRemaining: z.number().finite(),
    capHit: z.string(),
    status: z.string(),
  })
  .passthrough();
const draftSession = z
  .object({
    id: z.string().min(1),
    saveId: z.string().min(1),
    rngSeed: z.number().finite(),
    rngState: z.number().finite(),
    currentPickIndex: z.number().int().nonnegative(),
    mode: z.enum(['mock', 'real']),
    status: z.enum(['in_progress', 'completed']),
    userTeamAbbr: z.string(),
    maxRounds: z.number().int().positive(),
    isPaused: z.boolean(),
    picks: z.array(
      z
        .object({
          id: z.string(),
          overall: z.number().int(),
          round: z.number().int(),
          ownerTeamAbbr: z.string(),
          originalTeamAbbr: z.string(),
        })
        .passthrough(),
    ),
    prospects: z.array(player),
  })
  .passthrough();
const stateSchema = z
  .object({
    header: z
      .object({
        id: z.string().min(1),
        teamAbbr: z.string(),
        year: z.number().int(),
        capSpace: z.number().finite(),
        capLimit: z.number().finite(),
        phase: z.string(),
      })
      .passthrough(),
    roster: z.array(player),
    freeAgents: z.array(player),
    teamRosters: z.record(z.string(), z.array(player)),
    teamCaps: z.record(z.string(), z.number().finite()),
    draftPickAssets: z
      .array(
        z
          .object({
            id: z.string(),
            year: z.number().int(),
            round: z.number().int().positive(),
            owningTeamAbbr: z.string(),
            originalTeamAbbr: z.string(),
            projectedValuePoints: z.number().finite(),
            futureDiscount: z.number().finite(),
          })
          .passthrough(),
      )
      .min(1),
    transactions: z.array(z.unknown()),
    draftSessions: z.record(z.string(), draftSession),
    expiringContracts: z.array(z.unknown()),
    newsFeed: z.array(z.unknown()),
    rosterMoves: z.object({
      cuts: z.array(z.unknown()),
      resigns: z.array(z.unknown()),
      trades: z.array(z.unknown()),
    }),
    offseason: z
      .object({
        hydrated: z.boolean(),
        otcRows: z.array(z.unknown()),
        resolvedPlayerIds: z.array(z.string()),
        walkawayPlayerIds: z.array(z.string()),
        freeAgencyWave: z.number().int().min(1).max(3),
        initialFreeAgentCount: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();
export function recoveryReport(value: unknown, saveId: string, team: string) {
  const result = stateSchema.safeParse(value);
  const missing = result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join('.') || 'runtime');
  if (result.success) {
    if (result.data.header.id !== saveId) missing.push('header.id does not match owned save');
    if (result.data.header.teamAbbr !== team)
      missing.push('header.teamAbbr does not match owned save');
    if (stableJson(result.data.roster) !== stableJson(result.data.teamRosters[team]))
      missing.push('owned roster copies disagree');
    for (const [id, session] of Object.entries(result.data.draftSessions)) {
      if (
        id !== session.id ||
        session.saveId !== saveId ||
        session.currentPickIndex > session.picks.length
      )
        missing.push(`draftSessions.${id}.continuation`);
    }
    const rights = new Set(
      result.data.draftPickAssets.map(
        (pick) => `${pick.year}:${pick.round}:${pick.originalTeamAbbr}`,
      ),
    );
    for (let year = result.data.header.year; year <= result.data.header.year + 3; year++) {
      for (const t of TEAM_LIST)
        for (let round = 1; round <= 7; round++)
          if (!rights.has(`${year}:${round}:${t.abbr}`))
            missing.push(`draftPickAssets.${year}.${round}.${t.abbr}`);
    }
    for (const t of TEAM_LIST) {
      if (!Object.hasOwn(result.data.teamRosters, t.abbr)) missing.push(`teamRosters.${t.abbr}`);
      if (!Object.hasOwn(result.data.teamCaps, t.abbr)) missing.push(`teamCaps.${t.abbr}`);
    }
  }
  return {
    complete: missing.length === 0,
    missing: [...new Set(missing)],
    schemaVersion: STATE_SCHEMA_VERSION,
    warning:
      'Structural completeness cannot prove missing historical truth. Legacy migration requires explicit owner confirmation and retains the original record.',
  };
}
export function validateRuntime(value: unknown, saveId: string, team: string): SaveState {
  const report = recoveryReport(value, saveId, team);
  if (!report.complete) throw new Error(`Incomplete franchise state: ${report.missing.join(', ')}`);
  const copy = structuredClone(value) as SaveState;
  if (stableJson(copy.roster) !== stableJson(copy.teamRosters[team]))
    throw new Error('Owned roster copies disagree; reconciliation is required.');
  copy.roster = copy.teamRosters[team];
  return copy;
}
/** Only the immutable initial roster/pick/prospect objects enter the shared bundle. */
export function referenceBundle(runtime: SaveState): ReferenceBundle {
  const entities: ReferenceBundle = Object.create(null);
  function collect(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(collect);
      return;
    }
    if (!v || typeof v !== 'object') return;
    const record = v as Record<string, unknown>;
    if (typeof record.id === 'string') entities[record.id] = structuredClone(record);
  }
  Object.values(runtime.teamRosters).forEach(collect);
  collect(runtime.draftPickAssets);
  collect(runtime.expiringContracts);
  return entities;
}
export function encodeWorkspace(value: DurableWorkspace, references: ReferenceBundle): unknown {
  function encode(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(encode);
    if (!v || typeof v !== 'object') return v;
    const obj = v as Record<string, unknown>;
    const base =
      typeof obj.id === 'string' && Object.hasOwn(references, obj.id)
        ? references[obj.id]
        : undefined;
    if (base)
      return {
        $foReference: obj.id,
        changes: Object.fromEntries(
          Object.entries(obj).filter(
            ([k, x]) => x !== undefined && stableJson(x) !== stableJson(base[k]),
          ),
        ),
        removed: Object.keys(base).filter((k) => !Object.hasOwn(obj, k) || obj[k] === undefined),
      };
    return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, encode(x)]));
  }
  return encode(value);
}
export function decodeWorkspace(value: unknown, references: ReferenceBundle): DurableWorkspace {
  function decode(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(decode);
    if (!v || typeof v !== 'object') return v;
    const obj = v as Record<string, unknown>;
    if (typeof obj.$foReference === 'string') {
      if (
        !Object.hasOwn(references, obj.$foReference) ||
        !obj.changes ||
        !Array.isArray(obj.removed)
      )
        throw new Error('Missing or invalid immutable franchise reference.');
      const result = {
        ...structuredClone(references[obj.$foReference]),
        ...(obj.changes as object),
      };
      for (const k of obj.removed) {
        if (typeof k !== 'string') throw new Error('Invalid reference deletion.');
        delete (result as Record<string, unknown>)[k];
      }
      return result;
    }
    return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, decode(x)]));
  }
  const result = decode(value) as DurableWorkspace;
  if (!result?.runtime || !Array.isArray(result.trades))
    throw new Error('Invalid durable franchise envelope.');
  return result;
}
