import { Storage } from './core';
/** Private scheduler/owner library only; no HTTP endpoint. The eligible-prefix
 * queue is the continuation cursor: each atomic step removes at most 20/policy,
 * never skips an eligible key inserted behind a high-water cursor. Durable totals
 * are committed with the deletions; retry resumes from the remaining queue.
 * Payload bytes are never deleted here: the existing fenced GC owns that job. */
export async function expireDerivedDirectories(
  s: Storage,
  now = Date.now(),
  limit = 20,
  scoresOnly = false,
) {
  if (!Number.isSafeInteger(now) || !Number.isInteger(limit) || limit < 1 || limit > 20)
    throw Error('Invalid lifecycle step');
  const id = crypto.randomUUID();
  const statements = [
    s.statement(
      'DELETE FROM app_ai_cache WHERE cache_key IN (SELECT cache_key FROM app_ai_cache WHERE expires_at<=? AND lease_until<=? ORDER BY expires_at,cache_key LIMIT ?)',
      [now, now, limit],
    ),
    s.statement(
      "INSERT INTO app_storage_lifecycle_totals(policy,removed,last_run_at,last_run_id) VALUES('EXPIRED_AI',changes(),?,?) ON CONFLICT(policy) DO UPDATE SET removed=removed+excluded.removed,last_run_at=excluded.last_run_at,last_run_id=excluded.last_run_id",
      [now, id],
    ),
    s.statement(
      `DELETE FROM app_parlay_scores WHERE (event_id,model_version,context_key) IN (
  SELECT p.event_id,p.model_version,p.context_key FROM app_parlay_scores p
  LEFT JOIN app_sportsbook_events e ON e.id=p.event_id
  WHERE e.id IS NULL OR p.board_hash IS NOT e.markets_hash
  OR p.reference_version<>COALESCE((SELECT version FROM app_reference_version WHERE id=1),0)
  ORDER BY p.event_id,p.model_version,p.context_key LIMIT ?)`,
      [limit],
    ),
    s.statement(
      "INSERT INTO app_storage_lifecycle_totals(policy,removed,last_run_at,last_run_id) VALUES('SUPERSEDED_SCORES',changes(),?,?) ON CONFLICT(policy) DO UPDATE SET removed=removed+excluded.removed,last_run_at=excluded.last_run_at,last_run_id=excluded.last_run_id",
      [now, id],
    ),
  ];
  const result = await s.batch(scoresOnly ? statements.slice(2) : statements);
  return {
    expiredDerivedKeys: scoresOnly ? 0 : (result[0].meta.changes ?? 0),
    expiredScoreKeys: result[scoresOnly ? 0 : 2].meta.changes ?? 0,
    runId: id,
  };
}
