-- Internal owner-maintenance state only. Production scheduling remains disabled.
CREATE TABLE app_storage_retention_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('PREPARING','RUNNING','DONE')),archive_digest TEXT NOT NULL,archive_path TEXT NOT NULL,last_ordinal INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_retention_items(run_id TEXT NOT NULL REFERENCES app_storage_retention_plans(id),ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,operations_json TEXT NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;
CREATE TABLE app_storage_retention_audit(run_id TEXT NOT NULL,ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,archive_digest TEXT NOT NULL,retired_at INTEGER NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;

CREATE TABLE app_storage_candidate_receipts(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,external_id TEXT NOT NULL,canonical_url TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,UNIQUE(source_id,external_id)) WITHOUT ROWID;
