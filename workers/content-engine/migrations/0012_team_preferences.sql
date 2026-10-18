CREATE TABLE app_team_follows(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),team_id TEXT NOT NULL,is_primary INTEGER NOT NULL DEFAULT 0,notification_level TEXT NOT NULL DEFAULT 'DEFAULT',created_at INTEGER NOT NULL,UNIQUE(user_id,team_id));
CREATE UNIQUE INDEX app_one_primary_team ON app_team_follows(user_id) WHERE is_primary=1;
