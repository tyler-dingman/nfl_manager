import { Storage } from '../../packages/storage/core';
import { readPublishedOddsEvent } from '../../packages/storage/odds-snapshots';
import { D1OddsBoard } from '../../packages/storage/odds-board';
import { PrecomputedProps } from '../../packages/storage/parlay-scores';
import { computeTrendingProps } from '../../src/server/historical-stats/trending-props-service';
import { LAB_SCORE_CONFIG } from '../../packages/parlay/lab-score-config';
import { withApplicationBindings } from '../../src/server/persistence/bindings';
/** Internal work only: no provider requests and no additional odds refresh. */
export async function processOddsPublication(s: Storage, now = Date.now()) {
  const [task] = await s.rows<any>(
    `SELECT * FROM app_odds_processing WHERE (status='READY' OR (status='RUNNING' AND lease_until<?)) AND attempts<3 ${s.owner === 'D1_SHARED' ? "AND NOT EXISTS(SELECT 1 FROM app_odds_fetch_runs f WHERE f.slot=app_odds_processing.slot AND f.state<>'COMPLETE')" : ''} ORDER BY as_of,slot,event_id LIMIT 1`,
    [now],
  );
  if (!task) return { status: 'idle' };
  const nonce = crypto.randomUUID(),
    claimed = await s
      .statement(
        "UPDATE app_odds_processing SET status='RUNNING',lease_nonce=?,lease_until=?,attempts=attempts+1 WHERE slot=? AND event_id=? AND (status='READY' OR (status='RUNNING' AND lease_until<?)) RETURNING *",
        [nonce, now + 300000, task.slot, task.event_id, now],
      )
      .first();
  if (!claimed) return { status: 'busy' };
  try {
    const phased = s.owner === 'D1_SHARED';
    const eventId =
      phased && task.phase === 'SCORES'
        ? task.canonical_event_id
        : await new D1OddsBoard(s).publishProvider(
            (await readPublishedOddsEvent(s, JSON.parse(task.reference_json))) as any,
            task.as_of,
          );
    if (phased && task.phase === 'BOARD') {
      await s
        .statement(
          "UPDATE app_odds_processing SET phase='SCORES',canonical_event_id=?,status='READY',attempts=0,lease_until=0 WHERE slot=? AND event_id=? AND lease_nonce=?",
          [eventId, task.slot, task.event_id, nonce],
        )
        .run();
      return { status: 'board-ready', eventId };
    }
    const event = (await new D1OddsBoard(s).events(true)).find((e) => e.id === eventId)!;
    const opponents = {
        [event.homeTeamId]: event.awayTeamId,
        [event.awayTeamId]: event.homeTeamId,
      },
      teams = { homeTeamId: event.homeTeamId, awayTeamId: event.awayTeamId },
      scores = new PrecomputedProps(s),
      source = await scores.sources(eventId);
    await withApplicationBindings(
      {
        db: s.db,
        objects: s.objects,
        cacheNamespace: 'odds-processing:' + task.object_hash,
        env: { APP_DATA_BACKEND: 'd1' },
      },
      async () => {
        const result = await computeTrendingProps(eventId, opponents, event.season, teams, 'all');
        await scores.publish(
          eventId,
          LAB_SCORE_CONFIG.version,
          opponents,
          event.season,
          teams,
          source,
          result,
        );
      },
    );
    await s
      .statement(
        "UPDATE app_odds_processing SET status='DONE',lease_until=0,last_error=NULL WHERE slot=? AND event_id=? AND lease_nonce=?",
        [task.slot, task.event_id, nonce],
      )
      .run();
    return { status: 'done', eventId };
  } catch (error) {
    const superseded = String((error as Error).message).includes('superseded');
    await s
      .statement(
        'UPDATE app_odds_processing SET status=?,lease_until=0,last_error=? WHERE slot=? AND event_id=? AND lease_nonce=?',
        [
          superseded ? 'SUPERSEDED' : task.attempts + 1 >= 3 ? 'FAILED' : 'READY',
          superseded ? 'SUPERSEDED' : 'PROCESSING_FAILURE',
          task.slot,
          task.event_id,
          nonce,
        ],
      )
      .run();
    return { status: superseded ? 'superseded' : 'failed' };
  }
}
