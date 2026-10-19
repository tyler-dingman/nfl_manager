import { Storage } from './core';
/** Source-version contract, not an age window. read() already rejects these
 * caches; historical boards, scores referenced by saved evidence, and IDs remain
 * independently rooted. This removes only stale cache-directory rows. */
export async function expireSupersededScores(s: Storage, limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw Error('Retention batch 1–20');
  const r = await s
    .statement(
      `DELETE FROM app_parlay_scores WHERE (event_id,model_version,context_key) IN (
  SELECT p.event_id,p.model_version,p.context_key FROM app_parlay_scores p
  LEFT JOIN app_sportsbook_events e ON e.id=p.event_id
  WHERE e.id IS NULL OR p.board_hash IS NOT e.markets_hash
    OR p.reference_version<>COALESCE((SELECT version FROM app_reference_version WHERE id=1),0)
  ORDER BY p.event_id,p.model_version,p.context_key LIMIT ?)`,
      [limit],
    )
    .run();
  return { removed: r.meta.changes ?? 0 };
}
