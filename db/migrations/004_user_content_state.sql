BEGIN;

CREATE TABLE IF NOT EXISTS user_content_state (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER')),
  content_id text NOT NULL,
  media_version text,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  progress_seconds numeric,
  duration_seconds numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS user_content_state_user_updated_idx
  ON user_content_state(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_team_visit_state (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  last_visited_at timestamptz NOT NULL DEFAULT now(),
  last_seen_snapshot_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);

CREATE TABLE IF NOT EXISTS user_saved_content (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER')),
  content_id text NOT NULL,
  title text NOT NULL,
  href text,
  image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS user_saved_content_user_created_idx
  ON user_saved_content(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_predictions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  prediction jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  resolved_at timestamptz,
  result text CHECK (result IN ('PENDING', 'CORRECT', 'INCORRECT', 'VOID')),
  score numeric,
  UNIQUE (user_id, prediction_type, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS user_poll_votes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

COMMIT;