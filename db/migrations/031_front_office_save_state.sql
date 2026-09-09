BEGIN;

CREATE TABLE IF NOT EXISTS user_front_office_saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  save_id text NOT NULL,
  team_abbr text NOT NULL,
  season integer NOT NULL,
  selected_path text CHECK (selected_path IN ('full', 'free_agency', 'draft')),
  simulation_phase text,
  simulation_state jsonb,
  version integer NOT NULL DEFAULT 1,
  initialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, save_id)
);

CREATE INDEX IF NOT EXISTS user_front_office_saves_team_season_idx
  ON user_front_office_saves(user_id, team_abbr, season);

ALTER TABLE user_front_office_saves
  ADD COLUMN IF NOT EXISTS simulation_state jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

COMMIT;
