import { Storage } from './core';
import { expireDerivedDirectories } from './derived-lifecycle';
/** Compatibility entry point: all score-only cleanup shares the audited,
 * source-version-based lifecycle, including the legacy owner CLI option. */
export async function expireSupersededScores(s: Storage, limit = 20) {
  const result = await expireDerivedDirectories(s, Date.now(), limit, true);
  return { removed: result.expiredScoreKeys };
}
