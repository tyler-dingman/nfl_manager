BEGIN;

ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS installation_id text;
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_installation_idx
  ON user_devices(user_id, installation_id) WHERE installation_id IS NOT NULL;

ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS token_ciphertext text;
ALTER TABLE user_push_tokens DROP CONSTRAINT IF EXISTS user_push_tokens_provider_check;
ALTER TABLE user_push_tokens ADD CONSTRAINT user_push_tokens_provider_check
  CHECK (provider IN ('APNS', 'FCM', 'WEB_PUSH', 'EXPO'));

COMMIT;
