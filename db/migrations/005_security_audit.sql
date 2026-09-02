BEGIN;

CREATE TABLE IF NOT EXISTS security_audit_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'USER' CHECK (actor_type IN ('USER', 'SYSTEM', 'ADMIN')),
  ip_hash text,
  user_agent_family text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_audit_user_created_idx
  ON security_audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_type_created_idx
  ON security_audit_events(event_type, created_at DESC);

COMMIT;