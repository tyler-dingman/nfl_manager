-- Additive: original tables/IDs remain valid. Old inline JSON stays readable.
CREATE TABLE editorial_blobs (
 hash TEXT NOT NULL PRIMARY KEY,
 codec TEXT NOT NULL CHECK(codec IN ('identity','gzip')),
 byte_length INTEGER NOT NULL CHECK(byte_length>=0),
 body BLOB NOT NULL
) WITHOUT ROWID;
CREATE TABLE archive_chunks (
 chunk_id INTEGER PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('job','check','outbox')),
 day INTEGER NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 record_count INTEGER NOT NULL CHECK(record_count>0)
);
CREATE TABLE archive_records (
 kind TEXT NOT NULL,
 id TEXT NOT NULL,
 chunk_id INTEGER NOT NULL REFERENCES archive_chunks(chunk_id),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0),
 dedupe_key TEXT,
 PRIMARY KEY(kind,id),
 UNIQUE(kind,dedupe_key)
) WITHOUT ROWID;
CREATE TABLE source_check_daily (
 source_id TEXT NOT NULL REFERENCES content_sources(id),
 day INTEGER NOT NULL,
 checks INTEGER NOT NULL,
 successes INTEGER NOT NULL,
 first_attempt_at INTEGER NOT NULL,
 last_attempt_at INTEGER NOT NULL,
 PRIMARY KEY(source_id,day)
) WITHOUT ROWID;
CREATE INDEX jobs_archive_ready ON ingestion_jobs(status,updated_at,id);
CREATE INDEX checks_archive_ready ON source_checks(attempted_at,id);
