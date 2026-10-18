CREATE TABLE app_public_stories(id TEXT PRIMARY KEY,search_rowid INTEGER NOT NULL UNIQUE,team_id TEXT NOT NULL,story_type TEXT NOT NULL,importance REAL NOT NULL,first_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,evidence_at INTEGER NOT NULL,hot_until INTEGER,version INTEGER NOT NULL,visible INTEGER NOT NULL,object_hash TEXT NOT NULL);
CREATE INDEX app_public_story_team ON app_public_stories(team_id,visible,updated_at DESC,id DESC);
CREATE TABLE app_public_story_versions(id TEXT NOT NULL,version INTEGER NOT NULL,object_hash TEXT NOT NULL,PRIMARY KEY(id,version,object_hash)) WITHOUT ROWID;
CREATE TABLE app_public_wire(id TEXT PRIMARY KEY,story_id TEXT NOT NULL,team_id TEXT NOT NULL,story_version INTEGER NOT NULL,event_type TEXT NOT NULL,occurred_at INTEGER NOT NULL,object_hash TEXT NOT NULL);
CREATE INDEX app_public_wire_team ON app_public_wire(team_id,occurred_at DESC,id);
CREATE TABLE app_daily_briefings(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,briefing_date TEXT NOT NULL,generated_at INTEGER NOT NULL,published_at INTEGER NOT NULL,object_hash TEXT NOT NULL,summary_json TEXT NOT NULL DEFAULT '[]',UNIQUE(team_id,briefing_date));
CREATE INDEX app_daily_briefing_team ON app_daily_briefings(team_id,published_at DESC,id);
