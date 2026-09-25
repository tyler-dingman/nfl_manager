import { randomUUID } from 'node:crypto';
import {
  DRILL_QUESTION_COUNT,
  DRILL_PLAY_CLOCK_SECONDS,
} from '@/features/trivia/four-minute-drill';
import { authDb } from '@/server/auth/database';
import type { ScheduledTriviaEvent } from '@/features/trivia/scheduled-event';

export async function nextTriviaEvent(
  teamId: string,
  userId?: string,
): Promise<ScheduledTriviaEvent | null> {
  const rows = await authDb()`SELECT e.id,e.team_id,e.starts_at,e.ends_at,e.timezone,e.status,
    (SELECT count(*)::int FROM trivia_event_registrations r WHERE r.event_id=e.id) AS count,
    EXISTS(SELECT 1 FROM trivia_event_registrations r WHERE r.event_id=e.id AND r.user_id=${userId ?? null}::uuid) AS registered
    FROM trivia_events e WHERE e.team_id=${teamId} AND e.status IN ('SCHEDULED','LIVE') AND e.ends_at>now()
    ORDER BY CASE WHEN e.status='LIVE' OR e.starts_at<=now() THEN 0 ELSE 1 END,e.starts_at LIMIT 1`;
  const e = rows[0];
  return e
    ? {
        id: e.id,
        teamId: e.team_id,
        startsAt: e.starts_at.toISOString(),
        endsAt: e.ends_at.toISOString(),
        timezone: e.timezone,
        status: e.status,
        registrationCount: e.count,
        registered: e.registered,
      }
    : null;
}
export async function registerTriviaEvent(eventId: string, userId: string, join = false) {
  const db = authDb();
  return db.begin(async (tx) => {
    const [event] = await tx`SELECT * FROM trivia_events WHERE id=${eventId} FOR UPDATE`;
    if (!event || event.status === 'COMPLETED' || event.ends_at.getTime() <= Date.now())
      throw new Error('This event is no longer available.');
    const live = event.status === 'LIVE' || event.starts_at.getTime() <= Date.now();
    if (join && !live) throw new Error('This event has not started yet.');
    await tx`INSERT INTO trivia_event_registrations(event_id,user_id) VALUES(${eventId},${userId}) ON CONFLICT DO NOTHING`;
    if (!join) return { gameId: null };
    const [registration] =
      await tx`SELECT game_id FROM trivia_event_registrations WHERE event_id=${eventId} AND user_id=${userId}`;
    if (registration.game_id) return { gameId: String(registration.game_id) };
    // Reuse the event's existing question set in the existing individual drill engine.
    // Each entrant has independent timing/completion; this does not add synchronized play.
    const questions =
      await tx`SELECT q.id FROM trivia_game_questions gq JOIN trivia_questions q ON q.id=gq.question_id WHERE gq.game_id=${event.question_set_game_id} AND q.team_id=${event.team_id} AND q.active=true AND (q.verified=true OR ${process.env.NODE_ENV !== 'production'}) ORDER BY gq.position`;
    if (questions.length !== DRILL_QUESTION_COUNT)
      throw new Error('The event question set is not ready.');
    const gameId = randomUUID();
    await tx`INSERT INTO trivia_games(id,mode,team_id,created_by_user_id,question_count,timer_seconds) VALUES(${gameId},'FULL',${event.team_id},${userId},${DRILL_QUESTION_COUNT},${DRILL_PLAY_CLOCK_SECONDS})`;
    for (const [index, q] of questions.entries())
      await tx`INSERT INTO trivia_game_questions(game_id,question_id,position) VALUES(${gameId},${q.id},${index + 1})`;
    await tx`INSERT INTO trivia_game_participants(game_id,user_id) VALUES(${gameId},${userId})`;
    await tx`UPDATE trivia_event_registrations SET game_id=${gameId} WHERE event_id=${eventId} AND user_id=${userId}`;
    return { gameId };
  });
}
