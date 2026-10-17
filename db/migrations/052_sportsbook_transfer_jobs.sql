-- Preserve existing jobs and shared quota history. Historical table name is retained deliberately.
ALTER TABLE fanduel_transfer_jobs ADD COLUMN IF NOT EXISTS sportsbook text NOT NULL DEFAULT 'fanduel';
