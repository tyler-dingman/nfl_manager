-- Additive isolated alternatives. No production schema or original record is changed.
CREATE TABLE lean_heads (
 strategy TEXT NOT NULL CHECK(strategy IN ('A','B','C')),
 kind TEXT NOT NULL,
 id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 content_hash TEXT NOT NULL,
 object_hash TEXT NOT NULL,
 headline TEXT NOT NULL,
 category TEXT NOT NULL,
 source_id TEXT,
 published_at INTEGER NOT NULL,
 PRIMARY KEY(strategy,kind,id)
) WITHOUT ROWID;
CREATE TABLE lean_versions (
 strategy TEXT NOT NULL,
 kind TEXT NOT NULL,
 id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 object_hash TEXT NOT NULL,
 headline TEXT NOT NULL,
 category TEXT NOT NULL,
 source_id TEXT,
 published_at INTEGER NOT NULL,
 inline_json TEXT,
 PRIMARY KEY(strategy,kind,id,revision),
 FOREIGN KEY(strategy,kind,id) REFERENCES lean_heads(strategy,kind,id)
) WITHOUT ROWID;
CREATE INDEX lean_history_source ON lean_versions(strategy,source_id,published_at DESC,kind,id,revision);
CREATE TABLE lean_teams (
 strategy TEXT NOT NULL,
 kind TEXT NOT NULL,
 id TEXT NOT NULL,
 team_id TEXT NOT NULL REFERENCES nfl_teams(id),
 published_at INTEGER NOT NULL,
 PRIMARY KEY(strategy,team_id,kind,published_at DESC,id DESC),
 FOREIGN KEY(strategy,kind,id) REFERENCES lean_heads(strategy,kind,id)
) WITHOUT ROWID;
CREATE INDEX lean_hot_due ON lean_versions(strategy,published_at,kind,id,revision) WHERE inline_json IS NOT NULL;
CREATE TABLE lean_receipts (
 strategy TEXT NOT NULL,
 kind TEXT NOT NULL,
 id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL,
 object_hash TEXT NOT NULL,
 PRIMARY KEY(strategy,kind,id),
 UNIQUE(strategy,kind,dedupe_key)
) WITHOUT ROWID;
-- Bound identity updates independently of the growing per-team discovery index.
CREATE INDEX lean_teams_identity ON lean_teams(strategy,kind,id);
