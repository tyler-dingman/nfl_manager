BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

ALTER TABLE trivia_groups ADD COLUMN IF NOT EXISTS invite_token_hash text;
ALTER TABLE trivia_groups ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');
CREATE UNIQUE INDEX IF NOT EXISTS trivia_groups_invite_token_idx
  ON trivia_groups(invite_token_hash) WHERE invite_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS trivia_invitations (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  invited_phone_hash text,
  invite_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  CHECK (invited_phone_hash IS NULL OR length(invited_phone_hash) >= 32)
);
CREATE INDEX IF NOT EXISTS trivia_invitations_game_idx ON trivia_invitations(game_id,expires_at);

ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS wrong_answers integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS timeouts integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS response_time_total_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS best_question_score integer NOT NULL DEFAULT 0;
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS participant_status text NOT NULL DEFAULT 'JOINED';
ALTER TABLE trivia_game_participants DROP CONSTRAINT IF EXISTS trivia_game_participants_status_check;
ALTER TABLE trivia_game_participants ADD CONSTRAINT trivia_game_participants_status_check
  CHECK (participant_status IN ('INVITED','JOINED'));

CREATE TABLE IF NOT EXISTS trivia_rank_snapshots (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_position integer NOT NULL CHECK (question_position BETWEEN 0 AND 10),
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 5),
  score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id,user_id,question_position)
);

COMMIT;
