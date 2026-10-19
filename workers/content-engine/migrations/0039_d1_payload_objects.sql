-- Additive alternative to R2. Existing hashes, heads and rollback tables unchanged.
CREATE TABLE app_payload_objects (
 hash TEXT PRIMARY KEY CHECK(length(hash)=64),
 bytes INTEGER NOT NULL CHECK(bytes>=0 AND bytes<=4000000),
 chunks INTEGER NOT NULL CHECK(chunks>=0 AND chunks<=84),
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1))
) WITHOUT ROWID;
CREATE TABLE app_payload_chunks (
 hash TEXT NOT NULL REFERENCES app_payload_objects(hash),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<84),
 body TEXT NOT NULL CHECK(length(body)<=64000),
 PRIMARY KEY(hash,ordinal)
) WITHOUT ROWID;
CREATE TABLE app_payload_capacity (
 id INTEGER PRIMARY KEY CHECK(id=1),
 used_bytes INTEGER NOT NULL CHECK(used_bytes>=0 AND used_bytes<=64000000)
);
