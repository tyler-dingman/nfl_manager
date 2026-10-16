-- Local editorial graph only. IDs/JSON are retained; no PostgreSQL access.
PRAGMA foreign_keys = ON;
CREATE TABLE nfl_teams (id TEXT NOT NULL PRIMARY KEY,abbr TEXT NOT NULL UNIQUE);
INSERT INTO nfl_teams(id,abbr) VALUES
('ari','ARI'),
('atl','ATL'),
('bal','BAL'),
('buf','BUF'),
('car','CAR'),
('chi','CHI'),
('cin','CIN'),
('cle','CLE'),
('dal','DAL'),
('den','DEN'),
('det','DET'),
('gb','GB'),
('hou','HOU'),
('ind','IND'),
('jax','JAX'),
('kc','KC'),
('lac','LAC'),
('lar','LAR'),
('lv','LV'),
('mia','MIA'),
('min','MIN'),
('ne','NE'),
('no','NO'),
('nyg','NYG'),
('nyj','NYJ'),
('phi','PHI'),
('pit','PIT'),
('sea','SEA'),
('sf','SF'),
('tb','TB'),
('ten','TEN'),
('was','WAS');
CREATE TABLE content_sources (
  id TEXT NOT NULL PRIMARY KEY,
  team_id TEXT REFERENCES nfl_teams(id),
  league_wide INTEGER NOT NULL CHECK (league_wide IN (0,1)),
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  platform TEXT NOT NULL,
  priority INTEGER NOT NULL,
  next_check_at INTEGER NOT NULL,
  last_successful_at INTEGER,
  definition_hash TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  CHECK (team_id IS NOT NULL OR league_wide=1)
);
CREATE INDEX sources_due ON content_sources(enabled,next_check_at,priority DESC,id);
CREATE TABLE source_teams (
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  team_id TEXT NOT NULL REFERENCES nfl_teams(id),
  PRIMARY KEY (source_id,team_id)
);
CREATE INDEX source_teams_team ON source_teams(team_id,source_id);

CREATE TABLE content_candidates (
  id TEXT NOT NULL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  discovered_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (id,source_id),
  UNIQUE (source_id,external_id),
  UNIQUE (source_id,canonical_url)
);
CREATE INDEX candidates_fingerprint ON content_candidates(fingerprint);
CREATE INDEX candidates_source_time ON content_candidates(source_id,published_at DESC,id);
CREATE TABLE candidate_teams (
  candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
  team_id TEXT NOT NULL REFERENCES nfl_teams(id),
  PRIMARY KEY (candidate_id,team_id)
);
CREATE INDEX candidate_teams_team ON candidate_teams(team_id,candidate_id);

CREATE TABLE canonical_stories (
  id TEXT NOT NULL PRIMARY KEY,
  team_id TEXT REFERENCES nfl_teams(id),
  story_type TEXT NOT NULL,
  publication_state TEXT NOT NULL,
  status TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  importance_score INTEGER NOT NULL,
  confidence_score INTEGER NOT NULL,
  first_reported_at INTEGER NOT NULL,
  meaningful_update_at INTEGER NOT NULL,
  latest_evidence_at INTEGER,
  hot_read_until INTEGER,
  game_id TEXT,
  version INTEGER NOT NULL CHECK (version>0),
  content_hash TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE INDEX stories_feed ON canonical_stories(team_id,publication_state,meaningful_update_at DESC,latest_evidence_at DESC,id DESC);
CREATE INDEX stories_first_report ON canonical_stories(team_id,first_reported_at DESC,id DESC);
CREATE INDEX stories_importance ON canonical_stories(team_id,importance_score DESC,meaningful_update_at DESC,id DESC);
CREATE TABLE story_entities (
  entity_key TEXT NOT NULL,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  PRIMARY KEY (entity_key,story_id)
);
CREATE TABLE story_evidence (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  content_candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  first_seen_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,content_candidate_id),
  FOREIGN KEY(content_candidate_id,source_id) REFERENCES content_candidates(id,source_id)
);
CREATE INDEX evidence_story ON story_evidence(story_id,first_seen_at,id);
CREATE INDEX evidence_candidate ON story_evidence(content_candidate_id);
CREATE TABLE story_versions (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  version INTEGER NOT NULL CHECK(version>0),
  created_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,version)
);
CREATE TABLE story_publication_decisions (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL CHECK(story_version>0),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,story_version),
  FOREIGN KEY(story_id,story_version) REFERENCES story_versions(story_id,version)
);
CREATE TABLE story_editorial_overrides (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  team_id TEXT NOT NULL REFERENCES nfl_teams(id),
  surface TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0,1)),
  expires_at INTEGER,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE INDEX overrides_active ON story_editorial_overrides(team_id,surface,active,expires_at);
CREATE TABLE story_domain_events (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL CHECK(story_version>0),
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE editorial_cards (
  id TEXT NOT NULL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL CHECK(story_version>0),
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  descriptor_json TEXT NOT NULL CHECK (json_valid(descriptor_json)),
  UNIQUE (story_id,story_version,schema_version),
  FOREIGN KEY(story_id,story_version) REFERENCES story_versions(story_id,version)
);

CREATE TABLE video_source_registry (
  id TEXT NOT NULL PRIMARY KEY,
  source_id TEXT REFERENCES content_sources(id),
  channel_id TEXT UNIQUE,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE film_room_videos (
  video_id TEXT NOT NULL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  published_at INTEGER NOT NULL,
  metadata_checked_at INTEGER,
  availability TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE film_room_video_teams (
  team_id TEXT NOT NULL REFERENCES nfl_teams(id),
  video_id TEXT NOT NULL REFERENCES film_room_videos(video_id),
  PRIMARY KEY (team_id,video_id)
);
CREATE INDEX videos_published ON film_room_videos(published_at DESC,video_id);

CREATE TABLE three_and_out_snapshots (
  id TEXT NOT NULL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES nfl_teams(id),
  briefing_date TEXT,
  status TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  source_fingerprint TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE UNIQUE INDEX edition_team_date ON three_and_out_snapshots(team_id,briefing_date)
  WHERE briefing_date IS NOT NULL AND status='PUBLISHED';
CREATE INDEX editions_archive ON three_and_out_snapshots(team_id,briefing_date DESC,id);
CREATE TABLE public_schedule (
  game_id TEXT NOT NULL PRIMARY KEY,
  season INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  projection_version INTEGER NOT NULL CHECK(projection_version>0),
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);

CREATE TABLE ingestion_jobs (
  id TEXT NOT NULL PRIMARY KEY,
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('PENDING','RUNNING','DONE','DEAD')),
  source_id TEXT REFERENCES content_sources(id),
  candidate_id TEXT REFERENCES content_candidates(id),
  team_id TEXT REFERENCES nfl_teams(id),
  available_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK(max_attempts>0),
  lease_token TEXT,
  lease_until INTEGER,
  owner_epoch INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK((status='RUNNING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (status<>'RUNNING' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX jobs_due ON ingestion_jobs(status,available_at,team_id,id);
CREATE INDEX jobs_leases ON ingestion_jobs(status,lease_until);
CREATE TABLE content_outbox (
  event_id TEXT NOT NULL PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK(aggregate_version>0),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  available_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  acknowledged_at INTEGER,
  UNIQUE (aggregate_id,aggregate_version,event_type)
);
CREATE INDEX outbox_due ON content_outbox(acknowledged_at,available_at,event_id);
CREATE TABLE content_control (
  key TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK(version>0),
  value_json TEXT NOT NULL CHECK (json_valid(value_json))
);
CREATE TABLE content_run_log (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE INDEX run_log_time ON content_run_log(kind,occurred_at,id);
CREATE TABLE observer_run_items (
  run_id TEXT NOT NULL REFERENCES content_run_log(id),
  candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  PRIMARY KEY (run_id,candidate_id)
);
CREATE TABLE observer_run_events (
  run_id TEXT NOT NULL REFERENCES content_run_log(id),
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL CHECK(story_version>0),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  PRIMARY KEY (run_id,story_id,story_version)
);

-- A D1 atomic batch must abort on a zero-row logical CAS, not just SQL errors.
CREATE TABLE transaction_assertions(token TEXT NOT NULL PRIMARY KEY,value INTEGER NOT NULL CHECK(value=1));
CREATE TABLE source_checks(
 id TEXT NOT NULL PRIMARY KEY,source_id TEXT NOT NULL REFERENCES content_sources(id),
 attempted_at INTEGER NOT NULL,successful INTEGER NOT NULL CHECK(successful IN (0,1)),
 record_json TEXT NOT NULL CHECK(json_valid(record_json))
);
CREATE INDEX checks_source_time ON source_checks(source_id,attempted_at DESC,id);
CREATE TABLE source_checkpoints(
 source_id TEXT NOT NULL PRIMARY KEY REFERENCES content_sources(id),
 last_attempt_at INTEGER NOT NULL,last_successful_at INTEGER,
 etag TEXT,last_modified TEXT,cursor_json TEXT NOT NULL CHECK(json_valid(cursor_json))
);
CREATE INDEX videos_available_time ON film_room_videos(availability,published_at DESC,video_id DESC);
CREATE INDEX editions_published ON three_and_out_snapshots(team_id,status,generated_at DESC,id DESC);
CREATE INDEX jobs_claim ON ingestion_jobs(owner_epoch,status,available_at,id);
CREATE INDEX jobs_reclaim ON ingestion_jobs(owner_epoch,status,lease_until,id);
INSERT INTO content_control(key,version,value_json) VALUES('writer_epoch',1,'{"epoch":1}');
ALTER TABLE content_candidates ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
