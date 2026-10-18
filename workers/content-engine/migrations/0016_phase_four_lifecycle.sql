-- Additive indexes for bounded maintenance; no existing data is removed.
CREATE INDEX app_token_expiry ON app_tokens(expires_at,id) WHERE consumed_at IS NOT NULL;
CREATE INDEX app_ai_expiry ON app_ai_cache(expires_at,cache_key);
CREATE TABLE app_history_packs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,object_hash TEXT NOT NULL,rows INTEGER NOT NULL,created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_application_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1) WITHOUT ROWID;
