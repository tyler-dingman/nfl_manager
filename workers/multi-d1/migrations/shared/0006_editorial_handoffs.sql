CREATE TABLE app_editorial_handoffs(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES app_editorial_sources(id),external_id TEXT NOT NULL,canonical_url TEXT NOT NULL,target TEXT NOT NULL,object_hash TEXT,status TEXT NOT NULL CHECK(status IN('READY','SOURCE_READY','CANDIDATE_READY','DONE')),candidate_id TEXT,UNIQUE(source_id,external_id));
CREATE INDEX app_editorial_handoffs_ready ON app_editorial_handoffs(status,id);
CREATE INDEX app_editorial_handoffs_url ON app_editorial_handoffs(canonical_url);
