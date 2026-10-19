CREATE TABLE app_reference_import_lock(id INTEGER PRIMARY KEY CHECK(id=1),nonce TEXT NOT NULL,expires_at INTEGER NOT NULL);
