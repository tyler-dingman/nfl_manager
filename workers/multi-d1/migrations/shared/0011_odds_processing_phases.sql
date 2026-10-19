ALTER TABLE app_odds_processing ADD COLUMN phase TEXT NOT NULL DEFAULT 'BOARD' CHECK(phase IN('BOARD','SCORES'));
ALTER TABLE app_odds_processing ADD COLUMN canonical_event_id TEXT;
CREATE TABLE app_odds_fetch_runs(slot TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN('READY','UNCERTAIN','COMPLETE')),next_cursor TEXT,token TEXT NOT NULL,starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,pages INTEGER NOT NULL DEFAULT 0,books_json TEXT NOT NULL DEFAULT '[]',last_error TEXT) WITHOUT ROWID;
CREATE INDEX app_odds_fetch_ready ON app_odds_fetch_runs(state,slot);
