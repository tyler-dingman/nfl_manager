BEGIN;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE crew_activity ALTER COLUMN message TYPE text;
CREATE TABLE IF NOT EXISTS crew_media (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  uploader_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_media_crew_idx ON crew_media(crew_id);
CREATE TABLE IF NOT EXISTS crew_comments (
  id uuid PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES crew_activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_comments_activity_idx ON crew_comments(activity_id,created_at);
COMMIT;
