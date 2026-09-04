BEGIN;

ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS last_item_at timestamptz;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS average_latency_ms numeric(12,2);
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS request_count bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS observer_runs (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','CANCELLED')),
  observer_mode boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  scheduled_end_at timestamptz NOT NULL,
  completed_at timestamptz,
  thresholds jsonb NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observer_runs_team_time_idx ON observer_runs(team_id,started_at DESC);

CREATE TABLE IF NOT EXISTS observer_run_items (
  run_id uuid NOT NULL REFERENCES observer_runs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES content_candidates(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES content_sources(id),
  source_tier integer NOT NULL CHECK (source_tier BETWEEN 1 AND 3),
  content_type text NOT NULL,
  publication_time timestamptz NOT NULL,
  detection_time timestamptz NOT NULL,
  time_to_detection_ms bigint NOT NULL,
  PRIMARY KEY(run_id,candidate_id)
);
CREATE INDEX IF NOT EXISTS observer_items_source_idx ON observer_run_items(run_id,source_id,publication_time);

CREATE TABLE IF NOT EXISTS observer_run_events (
  run_id uuid NOT NULL REFERENCES observer_runs(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  story_version integer NOT NULL,
  event_creation_time timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  confidence integer NOT NULL,
  importance_score integer NOT NULL,
  score numeric(7,2) NOT NULL,
  sources jsonb NOT NULL,
  proposed_push text,
  proposed_story jsonb NOT NULL,
  notification_decision text NOT NULL,
  suppression_reason text,
  time_to_proposed_notification_ms bigint,
  PRIMARY KEY(run_id,story_id,story_version)
);
CREATE INDEX IF NOT EXISTS observer_events_filter_idx ON observer_run_events(run_id,notification_decision,category,confidence,captured_at);

COMMIT;
