import { EditorialDatabase } from './database';

/** Monday, Wednesday and Saturday at 15:00 UTC. UTC avoids DST double execution. */
export const ODDS_REFRESH_CRON = '0 15 * * 1,3,6';
export function oddsRefreshSlot(now: Date): string | null {
  if (!Number.isFinite(now.getTime())) throw Error('Invalid schedule clock');
  return [1, 3, 6].includes(now.getUTCDay()) && now.getUTCHours() === 15
    ? now.toISOString().slice(0, 10)
    : null;
}

/** At most one provider attempt per slot, including ambiguous failures/restarts.
 * A crash after the provider accepted a request must not silently consume quota again.
 * STARTED/UNCERTAIN slots need an operator's provider-usage reconciliation; no TTL retry.
 * Inject the reviewed provider adapter; this POC never fetches a provider itself.
 */
export async function runScheduledOdds(
  db: EditorialDatabase,
  now: Date,
  refresh: () => Promise<unknown>,
) {
  const slot = oddsRefreshSlot(now);
  if (!slot) return { status: 'outside-window' as const };
  const token = crypto.randomUUID();
  await db.batch('odds.schedule.claim', [
    db.statement(
      'INSERT INTO odds_refresh_slots(slot,token,state,started_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',
      [slot, token, 'STARTED', now.getTime()],
    ),
  ]);
  const [row] = await db.query<{ token: string; state: string }>(
    'odds.schedule.claim-check',
    'SELECT token,state FROM odds_refresh_slots WHERE slot=?',
    [slot],
    false,
  );
  if (row.token !== token) return { status: 'already-attempted' as const, state: row.state, slot };
  try {
    const summary = JSON.stringify(await refresh());
    if (!summary || new TextEncoder().encode(summary).length > 32000)
      throw Error('Invalid bounded odds refresh summary');
    await db.batch('odds.schedule.complete', [
      db.statement(
        'UPDATE odds_refresh_slots SET state=?,finished_at=?,summary_json=? WHERE slot=? AND token=?',
        ['COMPLETE', now.getTime(), summary, slot, token],
      ),
    ]);
    return { status: 'complete' as const, slot };
  } catch (error) {
    await db.batch('odds.schedule.uncertain', [
      db.statement('UPDATE odds_refresh_slots SET state=? WHERE slot=? AND token=?', [
        'UNCERTAIN',
        slot,
        token,
      ]),
    ]);
    throw error;
  }
}
