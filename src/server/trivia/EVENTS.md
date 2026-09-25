# Scheduled Four Minute Drill events

Migration `045_trivia_scheduled_events.sql` adds events and registrations without altering existing games or question records. It is included in the existing authentication migration runner. No sample events are seeded.

To schedule an event, supply a UUID, canonical team abbreviation, `starts_at`, `ends_at`, IANA `timezone`, and `question_set_game_id` referencing an existing trivia game with exactly ten active, verified questions for that team. The initial status is `SCHEDULED`. An explicitly `LIVE` event or one within its start/end window takes priority over future events; `COMPLETED` events and expired windows are excluded.

The public GET `/api/trivia/events?team=KC` returns schedule and aggregate registration metadata without question answers. Authenticated, same-origin POST `/api/trivia/events/{id}` accepts `register` or `join` as its action. The event/user primary key prevents duplicate registrations. Joining is serialized and idempotent: each registration receives one ordinary FULL trivia game using the event's question set and existing player. This provides independent drill timing and completion; it does not implement synchronized multiplayer questions or a live event leaderboard.

When no event exists or event loading is unavailable, the existing Trivia hero remains the fallback. Events are provisioned through the data layer; this task adds no scheduling/admin UI.
