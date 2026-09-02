BEGIN;

CREATE TABLE IF NOT EXISTS move_the_chains_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_drive_yards integer NOT NULL DEFAULT 0 CHECK (current_drive_yards BETWEEN 0 AND 99),
  touchdowns integer NOT NULL DEFAULT 0 CHECK (touchdowns >= 0),
  lifetime_yards integer NOT NULL DEFAULT 0 CHECK (lifetime_yards >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS move_the_chains_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('DAILY_TRIVIA_CORRECT', 'TRIVIA_CORRECT', 'PREDICTION_CORRECT', 'POLL_PARTICIPATION', 'GAME_DAY_CHECK_IN', 'ADMIN_ADJUSTMENT')),
  yards integer NOT NULL CHECK (yards >= 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trivia_questions (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  question text NOT NULL,
  answer_a text NOT NULL,
  answer_b text NOT NULL,
  answer_c text NOT NULL,
  answer_d text NOT NULL,
  correct_answer char(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation text NOT NULL,
  category text NOT NULL,
  season_reference integer,
  era text,
  source_note text,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trivia_questions_team_active_idx ON trivia_questions(team_id, active, id);

CREATE TABLE IF NOT EXISTS trivia_daily_questions (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  question_date date NOT NULL,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  UNIQUE (team_id, question_date)
);

CREATE TABLE IF NOT EXISTS trivia_games (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('QUICK', 'FULL', 'FRIEND_CHALLENGE', 'GROUP')),
  team_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED')),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trivia_game_questions (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  position integer NOT NULL CHECK (position >= 1),
  PRIMARY KEY (game_id, position),
  UNIQUE (game_id, question_id)
);

CREATE TABLE IF NOT EXISTS trivia_game_participants (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  completed_at timestamptz,
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS trivia_answers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  game_id uuid REFERENCES trivia_games(id) ON DELETE CASCADE,
  daily_question_id uuid REFERENCES trivia_daily_questions(id) ON DELETE CASCADE,
  selected_answer char(1) NOT NULL CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  correct boolean NOT NULL,
  response_time_ms integer NOT NULL CHECK (response_time_ms >= 0),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id, game_id),
  UNIQUE (user_id, daily_question_id)
);

CREATE INDEX IF NOT EXISTS trivia_answers_user_idx ON trivia_answers(user_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS trivia_answers_game_idx ON trivia_answers(game_id, answered_at);

CREATE TABLE IF NOT EXISTS trivia_friendships (
  requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (requester_user_id, addressee_user_id),
  CHECK (requester_user_id <> addressee_user_id)
);

CREATE TABLE IF NOT EXISTS trivia_challenges (
  id uuid PRIMARY KEY,
  challenger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenged_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS trivia_challenges_user_idx ON trivia_challenges(challenged_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS trivia_groups (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL UNIQUE REFERENCES trivia_games(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  host_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trivia_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lifetime_points integer NOT NULL DEFAULT 0,
  weekly_points integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  response_time_total_ms bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;