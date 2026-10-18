CREATE TABLE app_odds_history(id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL,as_of TEXT NOT NULL,object_hash TEXT NOT NULL,UNIQUE(provider_event_id,as_of)) WITHOUT ROWID;
