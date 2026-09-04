BEGIN;

ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS team_abbr text;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS content_id text;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS seen_at timestamptz;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'IN_APP_CREATED';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS push_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedupe_idx
  ON user_notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications(user_id,created_at DESC) WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS user_notifications_team_idx
  ON user_notifications(user_id,team_abbr,created_at DESC);

COMMIT;
