-- Email attempt reservations must commit atomically with the private mail outbox.
-- Sports API reservations remain independent in D1_SHARED.
CREATE TABLE app_limits(bucket TEXT PRIMARY KEY,used INTEGER NOT NULL CHECK(used>=0)) WITHOUT ROWID;
