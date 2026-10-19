import { MultiD1 } from './multi-d1';
import { D1UserWorkflows } from './user-workflows';
/** Lossless, conservative protection for existing/legacy quotes. A user snapshot is
 * permanent; matching source event boards stay pinned. No quote/provider verification
 * or board-release authorization is invented for legacy data lacking provenance. */
export async function saveCrossShardBet(router: MultiD1, user: string, input: any) {
  const play = input.metadata?.play,
    legs = play?.selections;
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > 50)
    throw Error('Invalid saved bet selections');
  const events = [
    ...new Set(
      legs
        .map((leg: any) => leg.eventId ?? play.event?.id)
        .filter((id: any) => typeof id === 'string' && id.length <= 300),
    ),
  ];
  const shared = router.shared(),
    users = router.users();
  const rows = events.length
    ? await shared.rows<{ hash: string }>(
        `SELECT DISTINCT object_hash AS hash FROM app_odds_board_history WHERE event_id IN(SELECT value FROM json_each(?)) UNION SELECT markets_hash AS hash FROM app_sportsbook_events WHERE id IN(SELECT value FROM json_each(?)) AND markets_hash IS NOT NULL`,
        [JSON.stringify(events), JSON.stringify(events)],
      )
    : [];
  const hashes = rows.map((r) => r.hash);
  if (hashes.some((h) => !/^[a-f0-9]{64}$/.test(h))) throw Error('Invalid saved source board');
  if (hashes.length)
    await shared
      .statement(
        "INSERT INTO app_storage_pins(hash,reason) SELECT value,'multi-d1-saved-bet' FROM json_each(?) WHERE 1 ON CONFLICT(hash) DO NOTHING",
        [JSON.stringify(hashes)],
      )
      .run();
  const metadata = {
    ...input.metadata,
    evidenceStatus: hashes.length ? 'SOURCE_BOARDS_RETAINED' : 'SELF_REPORTED_SNAPSHOT',
  };
  return new D1UserWorkflows(users).saveContent(user, { ...input, metadata }, [
    users.statement(
      'INSERT INTO app_saved_bet_receipts(user_id,content_id,boards_json,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,content_id) DO UPDATE SET boards_json=excluded.boards_json',
      [user, input.contentId, JSON.stringify(hashes), Date.now()],
    ),
  ]);
}
