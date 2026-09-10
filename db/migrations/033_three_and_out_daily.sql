BEGIN;

ALTER TABLE three_and_out_snapshots
  ADD COLUMN IF NOT EXISTS briefing_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS source_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS source_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS summary_version text NOT NULL DEFAULT 'daily-v1',
  ADD COLUMN IF NOT EXISTS audio_status text NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS three_and_out_daily_team_date_idx
  ON three_and_out_snapshots(team_id, briefing_date)
  WHERE briefing_date IS NOT NULL AND status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS three_and_out_push_deliveries (
  briefing_id text NOT NULL REFERENCES three_and_out_snapshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'PUSH',
  status text NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (briefing_id, user_id, channel)
);

COMMIT;
