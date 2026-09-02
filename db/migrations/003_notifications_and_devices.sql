BEGIN;

CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('IOS', 'ANDROID', 'WEB')),
  device_name text,
  app_version text,
  os_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  disabled_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON user_devices(user_id);

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('APNS', 'FCM', 'WEB_PUSH')),
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz,
  invalidated_at timestamptz,
  UNIQUE (user_id, device_id, provider, token_hash)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx ON user_push_tokens(user_id);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_type text,
  topic_id text,
  category text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'SMS', 'EMAIL', 'IN_APP')),
  enabled boolean NOT NULL DEFAULT true,
  minimum_priority text NOT NULL DEFAULT 'NORMAL' CHECK (minimum_priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_type, topic_id, category, channel)
);

CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (user_id, phone_number)
);

CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('SMS', 'EMAIL', 'PUSH', 'TERMS', 'PRIVACY')),
  consent_type text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_consents_user_type_idx ON user_consents(user_id, consent_type, channel);

CREATE TABLE IF NOT EXISTS user_quiet_hours (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  start_local_time text NOT NULL DEFAULT '22:00',
  end_local_time text NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  allow_breaking_override boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id text,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_notifications_user_id_idx ON user_notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'SMS', 'EMAIL', 'IN_APP')),
  device_id uuid REFERENCES user_devices(id) ON DELETE SET NULL,
  provider text NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  team_id text,
  player_id text,
  story_id text,
  priority text NOT NULL CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_type_idx ON notification_events(event_type, created_at DESC);

COMMIT;
