BEGIN;

CREATE TABLE IF NOT EXISTS fan_pulse_reactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  team_id text NOT NULL,
  reaction_type text NOT NULL CHECK (
    reaction_type IN ('FIRED_UP', 'LIKE_IT', 'NOT_SURE', 'DONT_LOVE_IT', 'NO_WAY')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS fan_pulse_reactions_content_idx
  ON fan_pulse_reactions (content_id, reaction_type);
CREATE INDEX IF NOT EXISTS fan_pulse_reactions_team_idx
  ON fan_pulse_reactions (team_id, updated_at DESC);

COMMIT;
