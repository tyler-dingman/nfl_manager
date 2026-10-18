-- Additive content-addressed directory. Existing market IDs remain intact.
ALTER TABLE app_sportsbook_events ADD COLUMN market_ids_hash TEXT;
