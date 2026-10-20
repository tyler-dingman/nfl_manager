-- Private staging credential throttling only. No raw IP, credential or cookie data.
CREATE TABLE app_storage_staging_access(key TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL CHECK(attempts>=1)) WITHOUT ROWID;
