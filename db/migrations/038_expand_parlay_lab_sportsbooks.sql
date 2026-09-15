BEGIN;

ALTER TABLE sportsbook_prices DROP CONSTRAINT IF EXISTS sportsbook_prices_sportsbook_check;
ALTER TABLE sportsbook_prices
  ADD CONSTRAINT sportsbook_prices_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS'));

ALTER TABLE sportsbook_price_snapshots
  DROP CONSTRAINT IF EXISTS sportsbook_price_snapshots_sportsbook_check;
ALTER TABLE sportsbook_price_snapshots
  ADD CONSTRAINT sportsbook_price_snapshots_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS'));

COMMIT;
