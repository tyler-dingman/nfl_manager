BEGIN;

CREATE TABLE IF NOT EXISTS content_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('OFFICIAL_TEAM','NFL_OFFICIAL','LOCAL_BEAT','LOCAL_OUTLET','NATIONAL_REPORTER','NATIONAL_OUTLET','RSS','YOUTUBE','PODCAST','OTHER')),
  team_id text,
  league_wide boolean NOT NULL DEFAULT false,
  url text NOT NULL,
  feed_url text,
  fetch_strategy text NOT NULL CHECK (fetch_strategy IN ('RSS','HTML','STRUCTURED_API','FIXTURE')),
  polling_tier text NOT NULL DEFAULT 'B' CHECK (polling_tier IN ('A','B','C')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  reliability_score numeric(4,3) NOT NULL DEFAULT 0.800 CHECK (reliability_score BETWEEN 0 AND 1),
  check_interval_seconds integer NOT NULL CHECK (check_interval_seconds >= 60),
  enabled boolean NOT NULL DEFAULT true,
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  last_successful_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (team_id IS NOT NULL OR league_wide = true)
);
CREATE INDEX IF NOT EXISTS content_sources_due_idx ON content_sources(enabled,next_check_at,priority DESC);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('SOURCE_FETCH','CANDIDATE_PROCESS')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','DEAD')),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingestion_jobs_claim_idx ON ingestion_jobs(status,available_at,created_at);

CREATE TABLE IF NOT EXISTS content_candidates (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES content_sources(id),
  external_id text NOT NULL,
  canonical_url text NOT NULL,
  title text NOT NULL,
  normalized_title text NOT NULL,
  author text,
  published_at timestamptz NOT NULL,
  source_updated_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  raw_text text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ANALYZED','DUPLICATE','CLUSTERED','REVIEW_REQUIRED','REJECTED','FAILED')),
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id,external_id)
);
CREATE INDEX IF NOT EXISTS content_candidates_fingerprint_idx ON content_candidates(fingerprint);
CREATE INDEX IF NOT EXISTS content_candidates_source_idx ON content_candidates(source_id,discovered_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS content_candidates_source_url_idx ON content_candidates(source_id,canonical_url);

CREATE TABLE IF NOT EXISTS canonical_stories (
  id uuid PRIMARY KEY,
  team_id text,
  story_type text NOT NULL DEFAULT 'ANALYSIS',
  headline text NOT NULL,
  summary text NOT NULL,
  what_happened text NOT NULL,
  why_it_matters text NOT NULL DEFAULT '',
  whats_next text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('BREAKING','DEVELOPING','HOLDING','RESOLVED')),
  publication_state text NOT NULL DEFAULT 'DRAFT' CHECK (publication_state IN ('DRAFT','AUTO_PUBLISHED','REVIEW_REQUIRED','PUBLISHED','REJECTED')),
  importance_score integer NOT NULL CHECK (importance_score BETWEEN 0 AND 100),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_reported_at timestamptz NOT NULL,
  last_meaningful_update_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS canonical_stories_team_idx ON canonical_stories(team_id,last_meaningful_update_at DESC);
CREATE INDEX IF NOT EXISTS canonical_stories_status_idx ON canonical_stories(status);
CREATE INDEX IF NOT EXISTS canonical_stories_importance_idx ON canonical_stories(importance_score DESC);
CREATE INDEX IF NOT EXISTS canonical_stories_updated_idx ON canonical_stories(last_meaningful_update_at DESC);

CREATE TABLE IF NOT EXISTS story_evidence (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  content_candidate_id uuid NOT NULL REFERENCES content_candidates(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES content_sources(id),
  source_url text NOT NULL,
  support_type text NOT NULL DEFAULT 'SUPPORTS' CHECK (support_type IN ('SUPPORTS','CONTRADICTS','CORRECTS','OFFICIAL_CONFIRMATION')),
  confidence numeric(4,3) NOT NULL DEFAULT 0.800 CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,content_candidate_id)
);
CREATE INDEX IF NOT EXISTS story_evidence_story_idx ON story_evidence(story_id,first_seen_at);
CREATE INDEX IF NOT EXISTS story_evidence_candidate_idx ON story_evidence(content_candidate_id);

CREATE TABLE IF NOT EXISTS story_versions (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  version integer NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  what_happened text NOT NULL,
  why_it_matters text NOT NULL,
  whats_next text NOT NULL,
  status text NOT NULL,
  publication_state text NOT NULL,
  importance_score integer NOT NULL,
  confidence_score integer NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  material_change_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,version)
);
CREATE INDEX IF NOT EXISTS story_versions_story_idx ON story_versions(story_id,version DESC);

CREATE TABLE IF NOT EXISTS story_domain_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('StoryCreated','StoryUpdated','StoryBecameBreaking','StoryResolved','StoryImportanceChanged')),
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  team_id text,
  story_version integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS story_domain_events_unprocessed_idx ON story_domain_events(processed_at,occurred_at);

INSERT INTO content_sources(id,name,source_type,team_id,league_wide,url,feed_url,fetch_strategy,polling_tier,priority,reliability_score,check_interval_seconds,enabled,metadata)
VALUES
('KC_CHIEFS_RSS','Kansas City Chiefs','OFFICIAL_TEAM','KC',false,'https://www.chiefs.com/','https://www.chiefs.com/rss/news','RSS','A',100,1.000,180,true,'{"seed":true}'::jsonb),
('CHI_BEAR_REPORT_RSS','Chicago Bears News','LOCAL_OUTLET','CHI',false,'https://www.chicagobears.com/','https://www.chicagobears.com/rss/news','RSS','B',85,0.900,600,true,'{"seed":true}'::jsonb),
('NFL_LEAGUE_RSS','NFL.com','NFL_OFFICIAL',NULL,true,'https://www.nfl.com/','https://www.nfl.com/rss/rsslanding?searchString=home','RSS','A',95,1.000,180,true,'{"seed":true}'::jsonb)
ON CONFLICT(id) DO NOTHING;

COMMIT;
