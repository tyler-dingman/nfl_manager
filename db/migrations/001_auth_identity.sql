BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  display_name text,
  first_name text,
  last_name text,
  primary_email text,
  email_verified boolean NOT NULL DEFAULT false,
  avatar_url text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS users_primary_email_unique
  ON users (lower(primary_email)) WHERE primary_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('APPLE', 'GOOGLE', 'FACEBOOK', 'EMAIL')),
  provider_subject text NOT NULL,
  provider_email text,
  provider_email_verified boolean NOT NULL DEFAULT false,
  provider_display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text,
  name text,
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  token_family_id uuid NOT NULL,
  replaced_by_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_metadata text,
  user_agent_metadata text
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_family_idx ON sessions(token_family_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'OAUTH_STATE')),
  token_hash text NOT NULL UNIQUE,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_type_idx ON auth_tokens(user_id, type);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  favorite_team_abbr text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
