/** Keep current encrypted Firebase revocations separately from historical backups,
 * alongside (never in place of) the existing independent application erasure ledger. */
import { sealDirectory, unsealDirectory } from '../packages/storage/backup-codec';
import type { SqlDatabase } from '../packages/storage/core';
type Revocation = { identity_hash: string; revoked_before: number; deleted: number };
type Deletion = {
  identity_hash: string;
  user_id: string | null;
  provider_deleted: number;
  erasure_requested: number;
  requested_at: number;
};
type Ledger = { schema: 1; revocations: Revocation[]; deletions: Deletion[] };
export async function sealFirebaseLedger(db: SqlDatabase, secret: string) {
  const revocations = await db
    .prepare(
      'SELECT identity_hash,revoked_before,deleted FROM app_firebase_revocations ORDER BY identity_hash',
    )
    .all<Revocation>();
  const deletions = await db
    .prepare(
      'SELECT identity_hash,user_id,provider_deleted,erasure_requested,requested_at FROM app_firebase_deletions ORDER BY identity_hash',
    )
    .all<Deletion>();
  return sealDirectory(
    { schema: 1, revocations: revocations.results, deletions: deletions.results },
    secret,
  );
}
export async function openFirebaseLedger(sealed: unknown, secret: string): Promise<Ledger> {
  const value = await unsealDirectory<Ledger>(sealed, secret);
  const hash = (x: string) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
  if (
    value.schema !== 1 ||
    !Array.isArray(value.revocations) ||
    !Array.isArray(value.deletions) ||
    value.revocations.some(
      (r) =>
        !hash(r.identity_hash) ||
        !Number.isSafeInteger(r.revoked_before) ||
        r.revoked_before < 0 ||
        ![0, 1].includes(r.deleted),
    ) ||
    value.deletions.some(
      (r) =>
        !hash(r.identity_hash) ||
        !(r.user_id === null || typeof r.user_id === 'string') ||
        ![0, 1].includes(r.provider_deleted) ||
        ![0, 1].includes(r.erasure_requested) ||
        !Number.isSafeInteger(r.requested_at) ||
        r.requested_at < 0,
    ) ||
    new Set(value.revocations.map((r) => r.identity_hash)).size !== value.revocations.length ||
    new Set(value.deletions.map((r) => r.identity_hash)).size !== value.deletions.length
  )
    throw Error('Invalid current Firebase revocation ledger');
  return value;
}
export async function replayFirebaseLedger(db: SqlDatabase, ledger: Ledger) {
  // Merge monotonically; a stale archive must never lower revocation or revive a deleted UID.
  for (const r of ledger.revocations)
    await db
      .prepare(
        'INSERT INTO app_firebase_revocations(identity_hash,revoked_before,deleted) VALUES(?,?,?) ON CONFLICT(identity_hash) DO UPDATE SET revoked_before=max(revoked_before,excluded.revoked_before),deleted=max(deleted,excluded.deleted)',
      )
      .bind(r.identity_hash, r.revoked_before, r.deleted)
      .run();
  for (const r of ledger.deletions) {
    const prior = await db
      .prepare('SELECT user_id FROM app_firebase_deletions WHERE identity_hash=?')
      .bind(r.identity_hash)
      .first<{ user_id: string | null }>();
    if (prior?.user_id && r.user_id && prior.user_id !== r.user_id)
      throw Error('Firebase deletion identity conflict');
    await db
      .prepare(
        'INSERT INTO app_firebase_deletions(identity_hash,user_id,provider_deleted,erasure_requested,requested_at) VALUES(?,?,?,?,?) ON CONFLICT(identity_hash) DO UPDATE SET provider_deleted=max(provider_deleted,excluded.provider_deleted),erasure_requested=max(erasure_requested,excluded.erasure_requested),user_id=CASE WHEN max(erasure_requested,excluded.erasure_requested)=1 THEN NULL ELSE coalesce(user_id,excluded.user_id) END',
      )
      .bind(r.identity_hash, r.user_id, r.provider_deleted, r.erasure_requested, r.requested_at)
      .run();
  }
}
