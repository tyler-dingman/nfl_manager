-- Additive publication pointer; failed refreshes never advance it.
CREATE TABLE app_odds_publication(id TEXT PRIMARY KEY CHECK(id='NFL'),slot TEXT NOT NULL,object_hash TEXT NOT NULL,completed_at INTEGER NOT NULL,coverage TEXT NOT NULL);
