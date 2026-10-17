BEGIN;
CREATE TABLE IF NOT EXISTS parlay_role_observations (
  id bigserial PRIMARY KEY,
  player_id text NOT NULL,
  team_id text NOT NULL,
  source text NOT NULL,
  source_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL,
  UNIQUE(player_id, team_id, source, source_at, evidence)
);
CREATE INDEX IF NOT EXISTS parlay_role_asof_idx ON parlay_role_observations(team_id, source_at DESC, received_at);
CREATE TABLE IF NOT EXISTS parlay_role_feed_runs (
  id bigserial PRIMARY KEY, source text NOT NULL, source_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(), rows_imported integer NOT NULL,
  complete boolean NOT NULL, diagnostics jsonb NOT NULL DEFAULT '{}'
);
COMMIT;
