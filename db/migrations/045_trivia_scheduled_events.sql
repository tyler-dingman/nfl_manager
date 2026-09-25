BEGIN;
CREATE TABLE IF NOT EXISTS trivia_events (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  question_set_game_id uuid NOT NULL REFERENCES trivia_games(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','LIVE','COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS trivia_events_upcoming_idx ON trivia_events(team_id,status,starts_at);
CREATE TABLE IF NOT EXISTS trivia_event_registrations (
  event_id uuid NOT NULL REFERENCES trivia_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid REFERENCES trivia_games(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
COMMIT;
