-- Preserve prior source revisions rather than losing the text used by published evidence.
CREATE TABLE content_candidate_revisions (
 candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 content_hash TEXT NOT NULL,
 observed_at INTEGER NOT NULL,
 record_json TEXT NOT NULL CHECK(json_valid(record_json)),
 PRIMARY KEY(candidate_id,revision)
);
