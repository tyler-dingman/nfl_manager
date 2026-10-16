-- Keep payloads below SQLite WITHOUT ROWID index overflow thresholds.
-- Existing inline blob rows stay readable; no automatic repack or removal.
ALTER TABLE editorial_blobs ADD COLUMN fragment_count INTEGER NOT NULL DEFAULT 0 CHECK(fragment_count>=0);
CREATE TABLE editorial_blob_fragments (
 hash TEXT NOT NULL REFERENCES editorial_blobs(hash),
 part INTEGER NOT NULL CHECK(part>=0),
 body BLOB NOT NULL CHECK(length(body)<=512),
 PRIMARY KEY(hash,part)
) WITHOUT ROWID;
