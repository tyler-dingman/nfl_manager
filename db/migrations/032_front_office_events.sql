BEGIN;

CREATE TABLE IF NOT EXISTS front_office_trade_offers (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  save_id text NOT NULL,
  proposing_team_abbr text NOT NULL,
  receiving_team_abbr text NOT NULL,
  offer_data jsonb NOT NULL,
  created_week integer NOT NULL,
  expires_week integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, save_id)
    REFERENCES user_front_office_saves(user_id, save_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS front_office_events (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  save_id text NOT NULL,
  dedupe_key text NOT NULL,
  type text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  headline text NOT NULL,
  summary text NOT NULL,
  team_abbr text,
  related_team_abbr text,
  player_id text,
  prospect_id text,
  trade_offer_id text,
  simulation_season integer NOT NULL,
  simulation_week integer NOT NULL,
  simulation_phase text NOT NULL,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  surfaced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, save_id, dedupe_key, simulation_season, simulation_week),
  FOREIGN KEY (user_id, save_id)
    REFERENCES user_front_office_saves(user_id, save_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, trade_offer_id)
    REFERENCES front_office_trade_offers(user_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS front_office_events_inbox_idx
  ON front_office_events(user_id, save_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS front_office_events_surface_idx
  ON front_office_events(user_id, save_id, surfaced_at, priority, created_at);
CREATE INDEX IF NOT EXISTS front_office_trade_offers_pending_idx
  ON front_office_trade_offers(user_id, save_id, status, expires_week);

COMMIT;
