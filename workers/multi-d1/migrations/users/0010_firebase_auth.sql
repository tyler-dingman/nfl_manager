-- Provider identities remain in app_identities; application UUIDs and all product data stay in D1.
CREATE TABLE app_firebase_sessions (
 session_id TEXT PRIMARY KEY REFERENCES app_sessions(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 identity_hash TEXT NOT NULL, id_token_ciphertext TEXT NOT NULL
);
CREATE INDEX app_firebase_sessions_user ON app_firebase_sessions(user_id);
-- Hash-only revocation tombstones intentionally survive account erasure.
CREATE TABLE app_firebase_revocations (
 identity_hash TEXT PRIMARY KEY, revoked_before INTEGER NOT NULL DEFAULT 0,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1))
) WITHOUT ROWID;
-- Durable deletion intent permits owner recovery if Firebase deletion succeeds but D1 fails.
CREATE TABLE app_firebase_deletions (
 identity_hash TEXT PRIMARY KEY, user_id TEXT,
 provider_deleted INTEGER NOT NULL DEFAULT 0, erasure_requested INTEGER NOT NULL DEFAULT 0,
 requested_at INTEGER NOT NULL
) WITHOUT ROWID;
