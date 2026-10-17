-- Additive archival directory. No existing payload is removed by this migration.
CREATE TABLE r2_archive_manifests (
 id TEXT PRIMARY KEY,
 object_key TEXT NOT NULL UNIQUE,
 object_hash TEXT NOT NULL,
 raw_hash TEXT NOT NULL,
 codec TEXT NOT NULL CHECK(codec IN ('identity','gzip')),
 schema_version INTEGER NOT NULL CHECK(schema_version=1),
 codec_version INTEGER NOT NULL CHECK(codec_version=1),
 record_count INTEGER NOT NULL CHECK(record_count>0 AND record_count<=8),
 object_bytes INTEGER NOT NULL,
 raw_bytes INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PREPARED','ACTIVE','RESTORED')),
 created_at INTEGER NOT NULL,
 verified_at INTEGER,
 recovery_until INTEGER NOT NULL
);
CREATE TABLE r2_archive_records (
 kind TEXT NOT NULL,
 record_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 manifest_id TEXT NOT NULL REFERENCES r2_archive_manifests(id),
 ordinal INTEGER NOT NULL,
 value_hash TEXT NOT NULL,
 original_json TEXT,
 pointer_json TEXT NOT NULL,
 PRIMARY KEY(kind,record_id,revision)
) WITHOUT ROWID;
CREATE INDEX r2_archive_members ON r2_archive_records(manifest_id,ordinal);
