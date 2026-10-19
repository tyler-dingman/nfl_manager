CREATE TABLE app_storage_gc_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('RUNNING','DONE')),last_hash TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_candidates(run_id TEXT NOT NULL REFERENCES app_storage_gc_plans(id),hash TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
