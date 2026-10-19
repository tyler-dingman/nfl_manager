-- LOCAL CANDIDATE SCHEMA. See ownership.json blockers before activation.
CREATE TABLE app_assertions(nonce TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1));
CREATE VIRTUAL TABLE app_search USING fts5(id UNINDEXED,team_id UNINDEXED,title,content,source_id UNINDEXED,source_url UNINDEXED,tokenize='unicode61');
CREATE TABLE app_public_stories(id TEXT PRIMARY KEY,search_rowid INTEGER NOT NULL UNIQUE,team_id TEXT NOT NULL,story_type TEXT NOT NULL,importance REAL NOT NULL,first_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,evidence_at INTEGER NOT NULL,hot_until INTEGER,version INTEGER NOT NULL,visible INTEGER NOT NULL,object_hash TEXT NOT NULL);
CREATE INDEX app_public_story_team ON app_public_stories(team_id,visible,updated_at DESC,id DESC);
CREATE TABLE app_public_story_versions(id TEXT NOT NULL,version INTEGER NOT NULL,object_hash TEXT NOT NULL,PRIMARY KEY(id,version,object_hash)) WITHOUT ROWID;
CREATE TABLE app_public_wire(id TEXT PRIMARY KEY,story_id TEXT NOT NULL,team_id TEXT NOT NULL,story_version INTEGER NOT NULL,event_type TEXT NOT NULL,occurred_at INTEGER NOT NULL,object_hash TEXT NOT NULL);
CREATE INDEX app_public_wire_team ON app_public_wire(team_id,occurred_at DESC,id);
CREATE TABLE app_daily_briefings(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,briefing_date TEXT NOT NULL,generated_at INTEGER NOT NULL,published_at INTEGER NOT NULL,object_hash TEXT NOT NULL,summary_json TEXT NOT NULL DEFAULT '[]',UNIQUE(team_id,briefing_date));
CREATE INDEX app_daily_briefing_team ON app_daily_briefings(team_id,published_at DESC,id);
CREATE TABLE app_editorial_sources(id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,team_id TEXT,league_wide INTEGER NOT NULL,source_type TEXT NOT NULL,polling_tier TEXT NOT NULL,priority INTEGER NOT NULL,enabled INTEGER NOT NULL,platform TEXT,object_hash TEXT NOT NULL,next_check_at INTEGER NOT NULL,last_checked_at INTEGER,last_successful_at INTEGER,last_item_at INTEGER,failure_count INTEGER NOT NULL DEFAULT 0,consecutive_failures INTEGER NOT NULL DEFAULT 0,average_latency_ms REAL,request_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,etag TEXT,last_modified TEXT,updated_at INTEGER NOT NULL);
CREATE INDEX app_editorial_sources_due ON app_editorial_sources(enabled,next_check_at,priority);
CREATE TABLE app_editorial_candidates(id TEXT PRIMARY KEY NOT NULL,source_id TEXT NOT NULL REFERENCES app_editorial_sources(id),external_id TEXT NOT NULL,canonical_url TEXT NOT NULL,fingerprint TEXT NOT NULL,published_at INTEGER NOT NULL,discovered_at INTEGER NOT NULL,teams TEXT NOT NULL,status TEXT NOT NULL,rejection_reason TEXT,object_hash TEXT NOT NULL,UNIQUE(source_id,external_id),UNIQUE(canonical_url));
CREATE INDEX app_editorial_candidates_team ON app_editorial_candidates(published_at,source_id);
CREATE TABLE app_editorial_jobs(id TEXT PRIMARY KEY NOT NULL,job_type TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 5,available_at INTEGER NOT NULL,locked_at INTEGER,locked_by TEXT,last_error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX app_editorial_jobs_ready ON app_editorial_jobs(status,available_at,created_at);
CREATE TABLE app_editorial_stories(id TEXT PRIMARY KEY NOT NULL,team_id TEXT,story_type TEXT NOT NULL,publication_state TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,object_hash TEXT NOT NULL,first_reported_at INTEGER NOT NULL,last_meaningful_update_at INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX app_editorial_stories_team ON app_editorial_stories(team_id,last_meaningful_update_at);
CREATE TABLE app_editorial_evidence(id TEXT PRIMARY KEY NOT NULL,story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),candidate_id TEXT NOT NULL REFERENCES app_editorial_candidates(id),source_id TEXT NOT NULL REFERENCES app_editorial_sources(id),first_seen_at INTEGER NOT NULL,UNIQUE(story_id,candidate_id));
CREATE TABLE app_editorial_versions(id TEXT PRIMARY KEY NOT NULL,story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),version INTEGER NOT NULL,object_hash TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(story_id,version));
CREATE TABLE app_editorial_events(id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL,story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),team_id TEXT,story_version INTEGER NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,object_hash TEXT NOT NULL,occurred_at INTEGER NOT NULL);
CREATE TABLE app_editorial_decisions(id TEXT PRIMARY KEY NOT NULL,story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),story_version INTEGER NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,confidence REAL NOT NULL,created_at INTEGER NOT NULL,UNIQUE(story_id,story_version));
CREATE TABLE app_story_overrides(id TEXT PRIMARY KEY NOT NULL,story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),action TEXT NOT NULL,surface TEXT NOT NULL,active INTEGER NOT NULL,expires_at INTEGER,created_at INTEGER NOT NULL,object_hash TEXT);
CREATE TABLE app_content_automation_runs(id TEXT PRIMARY KEY NOT NULL,trial_starts_at INTEGER,trial_expires_at INTEGER,polling_group TEXT,status TEXT NOT NULL,sources_due INTEGER NOT NULL DEFAULT 0,sources_queued INTEGER NOT NULL DEFAULT 0,jobs_processed INTEGER NOT NULL DEFAULT 0,generated_items INTEGER NOT NULL DEFAULT 0,failed_jobs INTEGER NOT NULL DEFAULT 0,ai_spend_usd REAL NOT NULL DEFAULT 0,object_hash TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER NOT NULL,CHECK(trial_starts_at IS NULL OR trial_expires_at-trial_starts_at=259200000));
CREATE INDEX app_automation_day ON app_content_automation_runs(started_at,trial_starts_at,trial_expires_at);
CREATE TABLE app_story_game_links(story_id TEXT PRIMARY KEY,game_id TEXT,resolution_json TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE app_observer_runs(id TEXT PRIMARY KEY NOT NULL,team_id TEXT NOT NULL,status TEXT NOT NULL,observer_mode INTEGER NOT NULL DEFAULT 1,started_at INTEGER NOT NULL,scheduled_end_at INTEGER NOT NULL,completed_at INTEGER,thresholds TEXT NOT NULL,error TEXT,created_at INTEGER NOT NULL);
CREATE INDEX app_observer_runs_team ON app_observer_runs(team_id,started_at DESC);
CREATE TABLE app_observer_items(run_id TEXT NOT NULL REFERENCES app_observer_runs(id),candidate_id TEXT NOT NULL REFERENCES app_editorial_candidates(id),source_id TEXT NOT NULL REFERENCES app_editorial_sources(id),source_tier INTEGER NOT NULL,content_type TEXT NOT NULL,publication_time INTEGER NOT NULL,detection_time INTEGER NOT NULL,time_to_detection_ms INTEGER NOT NULL,PRIMARY KEY(run_id,candidate_id));
CREATE TABLE app_observer_events(run_id TEXT NOT NULL REFERENCES app_observer_runs(id),story_id TEXT NOT NULL REFERENCES app_editorial_stories(id),story_version INTEGER NOT NULL,notification_decision TEXT NOT NULL,object_hash TEXT NOT NULL,captured_at INTEGER NOT NULL,PRIMARY KEY(run_id,story_id,story_version));
CREATE TABLE app_payload_objects (
 hash TEXT PRIMARY KEY CHECK(length(hash)=64),
 bytes INTEGER NOT NULL CHECK(bytes>=0 AND bytes<=4000000),
 chunks INTEGER NOT NULL CHECK(chunks>=0 AND chunks<=84),
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1))
, inline_data BLOB) WITHOUT ROWID;
CREATE TABLE app_payload_chunks (
 hash TEXT NOT NULL REFERENCES app_payload_objects(hash),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<84),
 body TEXT NOT NULL CHECK(length(body)<=64000), data BLOB,
 PRIMARY KEY(hash,ordinal)
) WITHOUT ROWID;
CREATE TABLE app_payload_capacity (
 id INTEGER PRIMARY KEY CHECK(id=1),
 used_bytes INTEGER NOT NULL CHECK(used_bytes>=0 AND used_bytes<=64000000)
);
CREATE TABLE app_storage_epoch(id INTEGER PRIMARY KEY CHECK(id=1),epoch INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)));
CREATE TABLE app_storage_guards(id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1)) WITHOUT ROWID;
CREATE TABLE app_storage_pins(hash TEXT PRIMARY KEY CHECK(length(hash)=64),reason TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_audit(run_id TEXT NOT NULL,hash TEXT NOT NULL,encoded_bytes INTEGER NOT NULL,deleted_at INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
CREATE TABLE app_storage_gc_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('RUNNING','DONE')),last_hash TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_gc_candidates(run_id TEXT NOT NULL REFERENCES app_storage_gc_plans(id),hash TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(run_id,hash)) WITHOUT ROWID;
CREATE TABLE app_storage_lifecycle_totals(policy TEXT PRIMARY KEY,removed INTEGER NOT NULL CHECK(removed>=0),last_run_at INTEGER NOT NULL,last_run_id TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_retention_plans(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('PREPARING','RUNNING','DONE')),archive_digest TEXT NOT NULL,archive_path TEXT NOT NULL,last_ordinal INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE app_storage_retention_items(run_id TEXT NOT NULL REFERENCES app_storage_retention_plans(id),ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,operations_json TEXT NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;
CREATE TABLE app_storage_retention_audit(run_id TEXT NOT NULL,ordinal INTEGER NOT NULL,kind TEXT NOT NULL,original_id TEXT NOT NULL,archive_digest TEXT NOT NULL,retired_at INTEGER NOT NULL,PRIMARY KEY(run_id,ordinal)) WITHOUT ROWID;
CREATE TABLE app_storage_candidate_receipts(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,external_id TEXT NOT NULL,canonical_url TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,UNIQUE(source_id,external_id)) WITHOUT ROWID;
CREATE TABLE app_storage_poll_batch (
  id INTEGER PRIMARY KEY CHECK(id=1),
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE app_storage_poll_retry (
  source_id TEXT PRIMARY KEY REFERENCES app_editorial_sources(id),
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
