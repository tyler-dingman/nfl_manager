ALTER TABLE app_sportsbook_events ADD COLUMN market_lookup_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(market_lookup_json) AND length(CAST(market_lookup_json AS BLOB))<=1900000);
