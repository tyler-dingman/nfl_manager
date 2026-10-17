-- Isolated scheduling POC only. Does not activate any provider or cron.
CREATE TABLE odds_refresh_slots (
 slot TEXT PRIMARY KEY,
 token TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('STARTED','COMPLETE','UNCERTAIN')),
 started_at INTEGER NOT NULL,
 finished_at INTEGER,
 summary_json TEXT
) WITHOUT ROWID;
