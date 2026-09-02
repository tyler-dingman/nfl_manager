BEGIN;
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/Chicago', locale text NOT NULL DEFAULT 'en-US',
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step smallint NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO user_profiles (user_id) SELECT id FROM users ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS audio_playback_speed numeric(3,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS autoplay_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reduced_motion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_around_league boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_landing_experience text NOT NULL DEFAULT 'HOME',
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_poll_results_before_voting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prediction_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS intensity text NOT NULL DEFAULT 'LOCKED_IN',
  ADD COLUMN IF NOT EXISTS advanced_notifications jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_audio_speed_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_audio_speed_check CHECK (audio_playback_speed IN (0.75,1.00,1.25,1.50,2.00));
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_landing_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_landing_check CHECK (preferred_landing_experience IN ('HOME','HUDDLE','THREE_AND_OUT','WATCH','WIRE','FRONT_OFFICE'));
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_prediction_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_prediction_check CHECK (prediction_visibility IN ('PRIVATE','FRIENDS','PUBLIC'));
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_intensity_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_intensity_check CHECK (intensity IN ('CASUAL','LOCKED_IN','SICKO'));

CREATE TABLE IF NOT EXISTS user_team_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id text NOT NULL, is_primary boolean NOT NULL DEFAULT false,
  notification_level text NOT NULL DEFAULT 'DEFAULT' CHECK (notification_level IN ('OFF','MAJOR','DEFAULT','ALL')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, team_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_team_follows_one_primary ON user_team_follows(user_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS user_team_follows_team_idx ON user_team_follows(team_id);

CREATE TABLE IF NOT EXISTS user_player_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, player_id)
);
CREATE INDEX IF NOT EXISTS user_player_follows_player_idx ON user_player_follows(player_id);

CREATE TABLE IF NOT EXISTS email_change_requests (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email text NOT NULL, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_change_requests_user_idx ON email_change_requests(user_id);
COMMIT;
