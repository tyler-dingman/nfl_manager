BEGIN;
CREATE TABLE IF NOT EXISTS three_and_out_snapshots (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  story_ids jsonb NOT NULL,
  story_versions jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS three_and_out_snapshots_team_idx ON three_and_out_snapshots(team_id,generated_at DESC);

CREATE TABLE IF NOT EXISTS story_editorial_overrides (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  surface text NOT NULL CHECK(surface IN ('PUBLIC','HUDDLE','THREE_AND_OUT')),
  action text NOT NULL CHECK(action IN ('PIN','PROMOTE','EXCLUDE','HIDE')),
  value integer,
  active boolean NOT NULL DEFAULT true,
  editor_id text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_editorial_overrides_active_idx ON story_editorial_overrides(team_id,surface,active);
COMMIT;
