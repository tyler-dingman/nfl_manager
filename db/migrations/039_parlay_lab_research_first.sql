BEGIN;

ALTER TABLE bet_markets
  ADD COLUMN IF NOT EXISTS provider_market_name text,
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'KNOWN',
  ADD COLUMN IF NOT EXISTS raw_provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE bet_markets DROP CONSTRAINT IF EXISTS bet_markets_normalization_status_check;
ALTER TABLE bet_markets ADD CONSTRAINT bet_markets_normalization_status_check
  CHECK (normalization_status IN ('KNOWN', 'PARTIALLY_MAPPED', 'UNMAPPED'));

ALTER TABLE sportsbook_prices DROP CONSTRAINT IF EXISTS sportsbook_prices_sportsbook_check;
ALTER TABLE sportsbook_prices ADD CONSTRAINT sportsbook_prices_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS', 'BET365'));

ALTER TABLE sportsbook_price_snapshots
  DROP CONSTRAINT IF EXISTS sportsbook_price_snapshots_sportsbook_check;
ALTER TABLE sportsbook_price_snapshots ADD CONSTRAINT sportsbook_price_snapshots_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS', 'BET365'));

CREATE INDEX IF NOT EXISTS bet_markets_normalization_status_idx
  ON bet_markets (normalization_status, market_type);

COMMIT;
