import { decodeObject } from './codec';
import { decode, type SqlDatabase } from './core';
import { saveCrossShardBet } from './cross-shard-bets';
import { MultiD1 } from './multi-d1';
import { EditorialDirectory, type EditorialEntity } from './editorial-directory';
import { D1UserWorkflows } from './user-workflows';
import { PublicEditorial } from './editorial';
/** A conservative pin-before-save saga. PREPARED receipts are retention roots too.
 * Authorization remains the authenticated caller's user ID; client metadata never chooses an owner. */
export async function saveCrossShardContent(router: MultiD1, user: string, input: any) {
  if (input.contentType === 'OTHER' && input.metadata?.kind === 'PARLAY')
    return saveCrossShardBet(router, user, input);
  const kind: EditorialEntity | null =
    input.contentType === 'STORY'
      ? 'public'
      : input.contentType === 'THREE_AND_OUT'
        ? 'briefing'
        : null;
  if (!kind) return new D1UserWorkflows(router.users()).saveContent(user, input);
  const owner = await new EditorialDirectory(router).resolve(kind, input.contentId);
  if (!owner) throw Error('Saved editorial content does not exist');
  const target = router.storage(owner),
    table = kind === 'public' ? 'app_public_stories' : 'app_daily_briefings';
  if (kind === 'public' && !(await new PublicEditorial(target).get(input.contentId)))
    throw Error('Article is not public');
  const [row] = await target.rows<{ object_hash: string }>(
    `SELECT object_hash FROM ${table} WHERE id=?`,
    [input.contentId],
  );
  if (!row) throw Error('Saved target disappeared');
  const users = router.users();
  await users
    .statement(
      "INSERT INTO app_cross_shard_references(user_id,kind,content_id,owner,object_hash,state,updated_at) VALUES(?,?,?,?,?,'PREPARED',?) ON CONFLICT(user_id,kind,content_id) DO UPDATE SET object_hash=excluded.object_hash,state='PREPARED',updated_at=excluded.updated_at WHERE owner=excluded.owner",
      [user, input.contentType, input.contentId, owner, row.object_hash, Date.now()],
    )
    .run();
  // Digest verification precedes pin creation; a nonexistent hash must never be accepted as evidence.
  await target.get(row.object_hash);
  await target
    .statement(
      "INSERT INTO app_storage_pins(hash,reason) VALUES(?,'multi-d1-reference') ON CONFLICT(hash) DO NOTHING",
      [row.object_hash],
    )
    .run();
  const saved = await new D1UserWorkflows(users).saveContent(user, input, [
    users.statement(
      "UPDATE app_cross_shard_references SET state='COMMITTED',updated_at=? WHERE user_id=? AND kind=? AND content_id=? AND owner=? AND object_hash=?",
      [Date.now(), user, input.contentType, input.contentId, owner, row.object_hash],
    ),
  ]);
  return saved;
}
/** Offline read only, used while every SDK writer is fenced. */
async function rawPayload(db: SqlDatabase, hash: string) {
  const head = await db
    .prepare('SELECT bytes,chunks,complete,inline_data FROM app_payload_objects WHERE hash=?')
    .bind(hash)
    .first<any>();
  if (!head || head.complete !== 1 || head.bytes > 4000000)
    throw Error('Missing saved metadata payload');
  let bytes: Uint8Array;
  if (head.inline_data != null) bytes = new Uint8Array(head.inline_data);
  else {
    const rows = await db
      .prepare('SELECT ordinal,data,body FROM app_payload_chunks WHERE hash=? ORDER BY ordinal')
      .bind(hash)
      .all<any>();
    if (rows.results.length !== head.chunks) throw Error('Incomplete saved metadata');
    bytes = new Uint8Array(head.bytes);
    let offset = 0;
    for (const [i, row] of rows.results.entries()) {
      if (row.ordinal !== i) throw Error('Invalid saved metadata chunk');
      const part =
        row.data == null
          ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
          : new Uint8Array(row.data);
      bytes.set(part, offset);
      offset += part.length;
    }
    if (offset !== head.bytes) throw Error('Invalid saved metadata length');
  }
  return JSON.parse(decode.decode(await decodeObject(bytes, hash)));
}
/** Unsave keeps the conservative pin/receipt until coordinated maintenance reconciliation.
 * Never delete a target pin in an ordinary request spanning two databases. */
export async function verifyCrossShardReferences(
  databases: Record<string, import('./core').SqlDatabase>,
) {
  const bets = await databases.D1_USERS.prepare(
    'SELECT user_id,content_id,boards_json FROM app_saved_bet_receipts',
  ).all<any>();
  const other = await databases.D1_USERS.prepare(
    "SELECT user_id,content_id,metadata_json,metadata_hash FROM app_saved_content WHERE content_type='OTHER'",
  ).all<any>();
  for (const row of other.results) {
    let metadata = JSON.parse(row.metadata_json);
    if (row.metadata_hash) {
      const envelope = await rawPayload(databases.D1_USERS, row.metadata_hash);
      if (
        envelope.owner !== row.user_id ||
        envelope.contentType !== 'OTHER' ||
        envelope.contentId !== row.content_id
      )
        throw Error('Saved betting metadata ownership mismatch');
      metadata = envelope.metadata;
    }
    if (
      metadata?.kind === 'PARLAY' &&
      !bets.results.some((r) => r.user_id === row.user_id && r.content_id === row.content_id)
    )
      throw Error('Legacy saved bet requires a verified retention receipt before cleanup');
  }
  for (const bet of bets.results) {
    const hashes = JSON.parse(bet.boards_json);
    if (!Array.isArray(hashes)) throw Error('Invalid saved betting receipt');
    for (const hash of hashes) {
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))
        throw Error('Invalid saved board hash');
      const row = await databases.D1_SHARED.prepare(
        'SELECT p.complete,s.hash FROM app_payload_objects p JOIN app_storage_pins s ON s.hash=p.hash WHERE p.hash=?',
      )
        .bind(hash)
        .first<any>();
      if (row?.complete !== 1) throw Error('Saved betting evidence is not protected');
    }
  }
  const saved = await databases.D1_USERS.prepare(
    "SELECT user_id,content_type,content_id FROM app_saved_content WHERE content_type IN('STORY','THREE_AND_OUT')",
  ).all<any>();
  const refs = await databases.D1_USERS.prepare(
    'SELECT * FROM app_cross_shard_references',
  ).all<any>();
  for (const item of saved.results)
    if (
      !refs.results.some(
        (r) =>
          r.user_id === item.user_id &&
          r.kind === item.content_type &&
          r.content_id === item.content_id,
      )
    )
      throw Error('Saved editorial content lacks a verified retention receipt');
  for (const ref of refs.results) {
    if (!/^D1_(TEAM_[1-8]|SHARED)$/.test(ref.owner)) throw Error('Invalid saved owner');
    const db = databases[ref.owner];
    if (!db) throw Error('Missing saved-reference shard');
    const payload = await db
      .prepare('SELECT complete FROM app_payload_objects WHERE hash=?')
      .bind(ref.object_hash)
      .first<any>();
    if (payload?.complete !== 1) throw Error('Missing saved reference payload');
    const pin = await db
      .prepare('SELECT hash FROM app_storage_pins WHERE hash=?')
      .bind(ref.object_hash)
      .first();
    if (!pin) throw Error('Missing saved reference retention pin');
  }
}
