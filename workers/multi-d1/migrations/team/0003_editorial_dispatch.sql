CREATE TABLE app_editorial_dispatch(id TEXT PRIMARY KEY,story_id TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,cursor TEXT NOT NULL DEFAULT '',done INTEGER NOT NULL DEFAULT 0 CHECK(done IN(0,1)));
CREATE INDEX app_editorial_dispatch_ready ON app_editorial_dispatch(done,id);
