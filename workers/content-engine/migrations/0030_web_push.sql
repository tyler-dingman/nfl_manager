ALTER TABLE app_push_tokens ADD COLUMN web_endpoint_hash TEXT;
CREATE UNIQUE INDEX app_web_push_endpoint ON app_push_tokens(web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL;
CREATE TABLE app_web_push_test_limits(user_id TEXT PRIMARY KEY REFERENCES app_users(id),attempted_at INTEGER NOT NULL);
