BEGIN;
CREATE TABLE IF NOT EXISTS content_automation_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  sources_due integer NOT NULL DEFAULT 0 CHECK (sources_due >= 0),
  sources_queued integer NOT NULL DEFAULT 0 CHECK (sources_queued >= 0),
  jobs_processed integer NOT NULL DEFAULT 0 CHECK (jobs_processed >= 0),
  generated_items integer NOT NULL DEFAULT 0 CHECK (generated_items >= 0),
  failed_jobs integer NOT NULL DEFAULT 0 CHECK (failed_jobs >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS content_automation_runs_started_at_idx
  ON content_automation_runs(started_at DESC);
COMMIT;
