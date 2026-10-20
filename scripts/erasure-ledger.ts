/** Offline encrypted revocation ledger. Keep the latest copy separately from
 * historical archives; restoring an older copy cannot discover later erasures. */
import { sealDirectory, unsealDirectory } from '../packages/storage/backup-codec';
import type { SqlDatabase } from '../packages/storage/core';
type Entry = { user_id: string; transfer_actor: string; requested_at: number };
export async function sealErasureLedger(db: SqlDatabase, secret: string) {
  const rows = await db
    .prepare('SELECT user_id,transfer_actor,requested_at FROM app_account_erasure ORDER BY user_id')
    .all<Entry>();
  return sealDirectory({ schema: 1, entries: rows.results }, secret);
}
export async function openErasureLedger(sealed: unknown, secret: string) {
  const value = await unsealDirectory<{ schema: number; entries: Entry[] }>(sealed, secret);
  if (
    value.schema !== 1 ||
    !Array.isArray(value.entries) ||
    new Set(value.entries.map((e) => e.user_id)).size !== value.entries.length ||
    value.entries.some(
      (e) =>
        !e.user_id ||
        !/^[a-f0-9]{64}$/.test(e.transfer_actor) ||
        !Number.isSafeInteger(e.requested_at),
    )
  )
    throw Error('Invalid current erasure ledger');
  return value.entries;
}
export async function replayErasureLedger(db: SqlDatabase, entries: Entry[]) {
  for (const e of entries) {
    const prior = await db
      .prepare('SELECT transfer_actor FROM app_account_erasure WHERE user_id=?')
      .bind(e.user_id)
      .first<any>();
    if (prior && prior.transfer_actor !== e.transfer_actor)
      throw Error('Erasure ledger identity conflict');
    await db.batch([
      db
        .prepare(
          "UPDATE app_users SET status='DELETED',primary_email=NULL,display_name=NULL,first_name=NULL,last_name=NULL,avatar_url=NULL,email_verified=0,updated_at=? WHERE id=?",
        )
        .bind(Date.now(), e.user_id),
      db
        .prepare(
          "INSERT INTO app_account_erasure(user_id,transfer_actor,cursor,status,requested_at,updated_at) SELECT ?,?,0,'RUNNING',?,? WHERE EXISTS(SELECT 1 FROM app_users WHERE id=?) ON CONFLICT(user_id) DO NOTHING",
        )
        .bind(e.user_id, e.transfer_actor, e.requested_at, Date.now(), e.user_id),
    ]);
  }
}
