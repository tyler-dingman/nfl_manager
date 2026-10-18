CREATE TABLE app_security_audit(id TEXT PRIMARY KEY,user_id TEXT REFERENCES app_users(id),event_type TEXT NOT NULL,ip_hash TEXT,user_agent_family TEXT,metadata_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX app_security_audit_owner ON app_security_audit(user_id,created_at DESC);
