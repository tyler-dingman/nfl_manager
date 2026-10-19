-- Additive: legacy base64 rows remain readable; new rows can carry binary bytes.
ALTER TABLE app_payload_chunks ADD COLUMN data BLOB;
CREATE TABLE app_storage_epoch(id INTEGER PRIMARY KEY CHECK(id=1),epoch INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)));
CREATE TABLE app_storage_guards(id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1)) WITHOUT ROWID;
CREATE TABLE app_storage_pins(hash TEXT PRIMARY KEY CHECK(length(hash)=64),reason TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_audit(run_id TEXT NOT NULL,hash TEXT NOT NULL,encoded_bytes INTEGER NOT NULL,deleted_at INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
