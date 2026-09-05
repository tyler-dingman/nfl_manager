BEGIN;
CREATE TABLE IF NOT EXISTS content_automation_trial_runs (
  id uuid PRIMARY KEY,
  trial_starts_at timestamptz NOT NULL,
  trial_expires_at timestamptz NOT NULL,
  polling_group text NOT NULL CHECK (polling_group IN ('standard','video')),
  status text NOT NULL,
  generated_items integer NOT NULL DEFAULT 0 CHECK (generated_items >= 0),
  ai_spend_usd numeric(10,4) NOT NULL DEFAULT 0 CHECK (ai_spend_usd >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (trial_expires_at = trial_starts_at + interval '72 hours')
);
CREATE INDEX IF NOT EXISTS content_automation_trial_window_idx
  ON content_automation_trial_runs(trial_starts_at,trial_expires_at,started_at);
COMMIT;
