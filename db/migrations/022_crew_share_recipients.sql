BEGIN;

CREATE TABLE IF NOT EXISTS crew_shares (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('CREW','TARGETED')),
  content_id text NOT NULL,
  content_type text NOT NULL,
  href text NOT NULL,
  title varchar(180) NOT NULL,
  message varchar(120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_shares_crew_idx ON crew_shares(crew_id,created_at DESC);
CREATE INDEX IF NOT EXISTS crew_shares_sender_idx ON crew_shares(sender_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS crew_share_recipients (
  share_id uuid NOT NULL REFERENCES crew_shares(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(share_id,user_id)
);
CREATE INDEX IF NOT EXISTS crew_share_recipients_user_idx
  ON crew_share_recipients(user_id,created_at DESC);

COMMIT;
