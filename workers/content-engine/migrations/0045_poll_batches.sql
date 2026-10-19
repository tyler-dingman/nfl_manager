-- One bounded, expiring global RSS lease. Existing jobs/history remain intact.
CREATE TABLE app_storage_poll_batch (
  id INTEGER PRIMARY KEY CHECK(id=1),
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload))
);

-- Pending/failed processing retains original inline feed evidence independently of the
-- global lease. No immutable object references are introduced by these tables.
CREATE TABLE app_storage_poll_retry (
  source_id TEXT PRIMARY KEY REFERENCES app_editorial_sources(id),
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
