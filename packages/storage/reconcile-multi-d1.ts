import { DATABASE_OWNERS, type DatabaseOwner } from './multi-d1';
import type { SqlDatabase } from './core';
/** Owner-only: caller must have verified/persisted a coherent archive with every
 * writer stopped and all epochs locked. No HTTP request may invoke this routine.
 * Saved betting receipts remain permanent; only editorial unsaves are reconciled.
 */
export async function reconcileMultiD1References(
  databases: Record<DatabaseOwner, SqlDatabase>,
  now: number,
) {
  for (const owner of DATABASE_OWNERS) {
    const epoch = await databases[owner]
      .prepare('SELECT locked FROM app_storage_epoch WHERE id=1')
      .first<any>();
    if (epoch?.locked !== 1) throw Error('Coordinated maintenance lock required');
  }
  const users = databases.D1_USERS;
  const stale = await users
    .prepare(
      `SELECT user_id,kind,content_id FROM app_cross_shard_references r
     WHERE updated_at<? AND NOT EXISTS(SELECT 1 FROM app_saved_content s
       WHERE s.user_id=r.user_id AND s.content_type=r.kind AND s.content_id=r.content_id)`,
    )
    .bind(now - 86400000)
    .all<any>();
  for (const ref of stale.results)
    await users
      .prepare('DELETE FROM app_cross_shard_references WHERE user_id=? AND kind=? AND content_id=?')
      .bind(ref.user_id, ref.kind, ref.content_id)
      .run();
  const refs = await users
    .prepare('SELECT owner,object_hash FROM app_cross_shard_references')
    .all<any>();
  const bets = await users.prepare('SELECT boards_json FROM app_saved_bet_receipts').all<any>();
  const betHashes = new Set<string>();
  for (const bet of bets.results) {
    const hashes = JSON.parse(bet.boards_json);
    if (
      !Array.isArray(hashes) ||
      hashes.some((h: unknown) => typeof h !== 'string' || !/^[a-f0-9]{64}$/.test(h))
    )
      throw Error('Invalid permanent saved-bet receipt');
    hashes.forEach((h: string) => betHashes.add(h));
  }
  let removedPins = 0;
  for (const owner of DATABASE_OWNERS.filter((o) => o !== 'D1_USERS')) {
    const db = databases[owner];
    const pins = await db
      .prepare("SELECT hash FROM app_storage_pins WHERE reason='multi-d1-reference'")
      .all<any>();
    for (const pin of pins.results) {
      if (
        refs.results.some((r) => r.owner === owner && r.object_hash === pin.hash) ||
        (owner === 'D1_SHARED' && betHashes.has(pin.hash))
      )
        continue;
      await db
        .prepare("DELETE FROM app_storage_pins WHERE hash=? AND reason='multi-d1-reference'")
        .bind(pin.hash)
        .run();
      removedPins++;
    }
    // Completed delivery is acknowledged; this compact intent has no unfinished recipients.
    await db.prepare('DELETE FROM app_editorial_dispatch WHERE done=1').run();
  }
  return {
    retiredEditorialReferences: stale.results.length,
    removedPins,
    permanentBetReceipts: bets.results.length,
  };
}
