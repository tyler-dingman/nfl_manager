BEGIN;
ALTER TABLE trivia_questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'MULTIPLE_CHOICE';
ALTER TABLE trivia_questions DROP CONSTRAINT IF EXISTS trivia_questions_type_check;
ALTER TABLE trivia_questions ADD CONSTRAINT trivia_questions_type_check CHECK (question_type IN ('MULTIPLE_CHOICE','TRUE_FALSE','IMAGE','ORDER','PLAYER_MATCH','STAT_CLOSEST','WHO_AM_I'));
ALTER TABLE trivia_games ADD COLUMN IF NOT EXISTS question_count integer NOT NULL DEFAULT 10 CHECK (question_count IN (5,10));
ALTER TABLE trivia_games ADD COLUMN IF NOT EXISTS timer_seconds integer NOT NULL DEFAULT 15 CHECK (timer_seconds BETWEEN 5 AND 60);
ALTER TABLE trivia_games DROP CONSTRAINT IF EXISTS trivia_games_status_check;
ALTER TABLE trivia_games ADD CONSTRAINT trivia_games_status_check CHECK(status IN('WAITING','ACTIVE','COMPLETED','EXPIRED'));
ALTER TABLE trivia_game_questions ADD COLUMN IF NOT EXISTS presented_at timestamptz;
ALTER TABLE trivia_answers ALTER COLUMN selected_answer DROP NOT NULL;
ALTER TABLE trivia_answers DROP CONSTRAINT IF EXISTS trivia_answers_selected_answer_check;
ALTER TABLE trivia_answers ADD CONSTRAINT trivia_answers_selected_answer_check CHECK (selected_answer IS NULL OR selected_answer IN ('A','B','C','D'));
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS best_game_score integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS ties integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS trivia_stats_lifetime_rank_idx ON trivia_stats(lifetime_points DESC,user_id);
CREATE INDEX IF NOT EXISTS trivia_stats_weekly_rank_idx ON trivia_stats(weekly_points DESC,user_id);
CREATE INDEX IF NOT EXISTS trivia_game_participants_user_idx ON trivia_game_participants(user_id,completed_at);
CREATE INDEX IF NOT EXISTS trivia_games_team_created_idx ON trivia_games(team_id,created_at DESC);
CREATE TABLE IF NOT EXISTS trivia_daily_views (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_question_id uuid NOT NULL REFERENCES trivia_daily_questions(id) ON DELETE CASCADE,
  presented_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,daily_question_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS trivia_friendships_pair_idx ON trivia_friendships(least(requester_user_id,addressee_user_id),greatest(requester_user_id,addressee_user_id));

-- Migration 006 came from an abandoned simplification. Restore the normalized
-- player-follow model required by the canonical profile specification.
CREATE TABLE IF NOT EXISTS user_player_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,player_id)
);
CREATE INDEX IF NOT EXISTS user_player_follows_player_idx ON user_player_follows(player_id);
COMMIT;
