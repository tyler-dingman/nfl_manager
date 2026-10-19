-- Bounded cumulative lifecycle audit; two policy rows, not a growing tombstone log.
CREATE TABLE app_storage_lifecycle_totals(policy TEXT PRIMARY KEY,removed INTEGER NOT NULL CHECK(removed>=0),last_run_at INTEGER NOT NULL,last_run_id TEXT NOT NULL) WITHOUT ROWID;
CREATE INDEX app_ai_cache_expiry ON app_ai_cache(expires_at,cache_key);
