BEGIN;

CREATE TABLE IF NOT EXISTS sportsbook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  league text NOT NULL CHECK (league = 'NFL'),
  season integer NOT NULL,
  week integer NOT NULL,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL,
  kickoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  markets_locked boolean NOT NULL DEFAULT false,
  first_imported_at timestamptz NOT NULL DEFAULT now(),
  refreshed_24h_at timestamptz,
  final_snapshot_at timestamptz,
  last_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS provider_team_mappings (
  provider text NOT NULL,
  provider_team_id text NOT NULL,
  team_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_team_id)
);

CREATE TABLE IF NOT EXISTS provider_player_mappings (
  provider text NOT NULL,
  provider_player_id text NOT NULL,
  player_id text NOT NULL,
  provider_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_player_id)
);

CREATE TABLE IF NOT EXISTS bet_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES sportsbook_events(id) ON DELETE CASCADE,
  provider_market_id text NOT NULL,
  market_type text NOT NULL,
  stat_id text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  player_id text,
  team_id text,
  period text NOT NULL DEFAULT 'game',
  side text NOT NULL DEFAULT '',
  line numeric,
  line_key numeric GENERATED ALWAYS AS (coalesce(line, -999999)) STORED,
  normalized_key text NOT NULL,
  is_alt_line boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider_market_id, side, line_key),
  UNIQUE (event_id, normalized_key)
);

CREATE TABLE IF NOT EXISTS sportsbook_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES bet_markets(id) ON DELETE CASCADE,
  sportsbook text NOT NULL CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS')),
  provider_selection_id text,
  provider_market_id text NOT NULL,
  provider_event_id text NOT NULL,
  odds integer,
  decimal_odds numeric,
  line numeric,
  available boolean NOT NULL DEFAULT false,
  deeplink text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, sportsbook)
);

CREATE TABLE IF NOT EXISTS sportsbook_price_snapshots (
  id bigserial PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES bet_markets(id) ON DELETE CASCADE,
  sportsbook text NOT NULL CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS')),
  odds integer,
  line numeric,
  available boolean NOT NULL,
  deeplink text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sportsbook_events_window_idx
  ON sportsbook_events(markets_locked, kickoff_at);
CREATE INDEX IF NOT EXISTS bet_markets_lookup_idx
  ON bet_markets(event_id, market_type, player_id, side, line);
CREATE INDEX IF NOT EXISTS sportsbook_prices_lookup_idx
  ON sportsbook_prices(market_id, sportsbook, available);

COMMIT;
