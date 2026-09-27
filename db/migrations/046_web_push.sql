BEGIN;
ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS web_endpoint_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_web_endpoint_idx
  ON user_push_tokens(web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS web_push_test_limits (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
