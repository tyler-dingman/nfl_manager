BEGIN;

CREATE TABLE IF NOT EXISTS crews (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  team_abbr text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crew_members (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','MEMBER')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','LEFT','REMOVED')),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(crew_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_members_one_active_crew_idx ON crew_members(user_id)
  WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS crew_members_crew_idx ON crew_members(crew_id,status);

CREATE TABLE IF NOT EXISTS crew_invites (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_hash text,
  recipient_hint text,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('IN_APP','SMS','EMAIL','SHARE_LINK')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  delivery_state text NOT NULL DEFAULT 'PENDING' CHECK (delivery_state IN ('PENDING','SENT','FAILED','NOT_CONFIGURED','DELIVERED')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_invites_crew_idx ON crew_invites(crew_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS crew_invites_pending_recipient_idx ON crew_invites(crew_id,recipient_hash)
  WHERE status='PENDING' AND recipient_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS crew_activity (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  content_id text,
  content_type text,
  href text,
  message varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_activity_feed_idx ON crew_activity(crew_id,created_at DESC);

CREATE TABLE IF NOT EXISTS crew_reactions (
  activity_id uuid NOT NULL REFERENCES crew_activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('FIRE','LAUGH','EYES','LIKE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(activity_id,user_id,reaction)
);

COMMIT;
