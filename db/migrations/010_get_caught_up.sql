BEGIN;

ALTER TABLE user_team_visit_state
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS current_visit_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_caught_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_caught_up_snapshot_id text,
  ADD COLUMN IF NOT EXISTS caught_up_story_state jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
