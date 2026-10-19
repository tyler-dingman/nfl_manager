CREATE TABLE app_briefing_mail_jobs(id TEXT PRIMARY KEY,object_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'READY',cursor TEXT,created_at INTEGER NOT NULL DEFAULT 0);
