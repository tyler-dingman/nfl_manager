# Down & Distance: database migration plan

October 16, 2026. Design only. SQL below is proposed design material inside this document; no SQL files were added or executed. See [ownership](TARGET_ARCHITECTURE.md) and [roadmap file manifest](IMPLEMENTATION_ROADMAP.md).

## Data contract and mapping

Keep PostgreSQL user/transactional tables intact. Move the editorial graph as a unit, not just `canonical_stories`: otherwise evidence joins, generation and Film Room will continue reading Neon. Preserve UUIDs as strings and existing text IDs. Do not replace IDs with newly generated SQLite integers.

| PostgreSQL representation                   | D1 representation / compatibility requirement                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| UUID/text PK                                | TEXT, byte-for-byte existing ID                                                                           |
| timestamptz                                 | INTEGER UTC epoch milliseconds in indexed fields; original normalized ISO timestamps in DTO/record JSON   |
| date                                        | `YYYY-MM-DD` TEXT; edition uses team/editorial date, delivery uses each user's timezone                   |
| boolean                                     | INTEGER with 0/1 CHECK; adapter returns boolean                                                           |
| jsonb                                       | TEXT with `json_valid`; preserve arrays, nulls and object values, not JSON serialized twice               |
| numeric scores                              | REAL or INTEGER as appropriate; preserve exact scores/rounding in DTO tests                               |
| jsonb team/entity membership                | Indexed join tables; retain original arrays in record JSON for lossless round-trip                        |
| arrays/ANY/ILIKE/interval/jsonb aggregation | Bound SQLite SQL plus shared formatting/filter logic; test case handling, substring behavior and ordering |
| PG locks/callback transactions              | D1 atomic batches, guarded updates, unique idempotency and expiring token leases                          |
| PG game FK                                  | Logical immutable game ID + versioned public schedule projection; no cross-database FK                    |
| search vector/HNSW                          | Remain in PostgreSQL; incremental derived index input from the new owner                                  |

The proposed schema uses `record_json` to retain the complete validated domain record, including less frequently queried fields from **all** later migrations. Indexed relational columns are deliberate projections of that record, updated in the same batch. Repository adapters reconstruct exactly the existing types. This avoids an accidental lossy rewrite of semantics/claims/graphic metadata while keeping common reads selective. Do not store an entire record twice in API projections unless the measured storage budget permits it.

Required JSON fields include every source property/health metric; candidate author, original URL/text/excerpt/entities/rejection/metadata; story what-happened/why/next/status/entities/first-reported/source counters/hot-read qualification/cluster reason/game resolution; complete version claims/evidence IDs; override action/value/editor/expiry; edition source windows/items/version/audio/status; registry tags/status/verification details. Export schema introspection must compare production columns with this mapping and stop on unmapped additions. Schema drift is a migration failure, not permission to discard fields.

## Proposed D1 schema

Use one database for 32 teams and NFL-wide records. No user IDs as relational identities, credentials, preferences, delivery recipients or private media. Audit-only editor identifiers may remain in protected editorial records; they are not authorization. This is a starting schema for local qualification, not a final remotely applied migration.

```sql
CREATE TABLE content_sources (
  id TEXT PRIMARY KEY,
  team_id TEXT,
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
  team_id TEXT NOT NULL,
  PRIMARY KEY (source_id,team_id)
);
CREATE INDEX source_teams_team ON source_teams(team_id,source_id);

CREATE TABLE content_candidates (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  discovered_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (source_id,external_id),
  UNIQUE (source_id,canonical_url)
);
CREATE INDEX candidates_fingerprint ON content_candidates(fingerprint);
CREATE INDEX candidates_source_time ON content_candidates(source_id,published_at DESC,id);
CREATE TABLE candidate_teams (
  candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
  team_id TEXT NOT NULL,
  PRIMARY KEY (candidate_id,team_id)
);
CREATE INDEX candidate_teams_team ON candidate_teams(team_id,candidate_id);

CREATE TABLE canonical_stories (
  id TEXT PRIMARY KEY,
  team_id TEXT,
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
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  content_candidate_id TEXT NOT NULL REFERENCES content_candidates(id),
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  first_seen_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,content_candidate_id)
);
CREATE INDEX evidence_story ON story_evidence(story_id,first_seen_at,id);
CREATE INDEX evidence_candidate ON story_evidence(content_candidate_id);
CREATE TABLE story_versions (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,version)
);
CREATE TABLE story_publication_decisions (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  UNIQUE (story_id,story_version)
);
CREATE TABLE story_editorial_overrides (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  team_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0,1)),
  expires_at INTEGER,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE INDEX overrides_active ON story_editorial_overrides(team_id,surface,active,expires_at);
CREATE TABLE story_domain_events (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE editorial_cards (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES canonical_stories(id),
  story_version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  descriptor_json TEXT NOT NULL CHECK (json_valid(descriptor_json)),
  UNIQUE (story_id,story_version,schema_version)
);

CREATE TABLE video_source_registry (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES content_sources(id),
  channel_id TEXT UNIQUE,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE film_room_videos (
  video_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_sources(id),
  published_at INTEGER NOT NULL,
  metadata_checked_at INTEGER,
  availability TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
CREATE TABLE film_room_video_teams (
  team_id TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES film_room_videos(video_id),
  PRIMARY KEY (team_id,video_id)
);
CREATE INDEX videos_published ON film_room_videos(published_at DESC,video_id);

CREATE TABLE three_and_out_snapshots (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
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
  game_id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  projection_version INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);

CREATE TABLE ingestion_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  source_id TEXT REFERENCES content_sources(id),
  candidate_id TEXT REFERENCES content_candidates(id),
  team_id TEXT,
  available_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  lease_token TEXT,
  lease_until INTEGER,
  owner_epoch INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_due ON ingestion_jobs(status,available_at,team_id,id);
CREATE INDEX jobs_leases ON ingestion_jobs(status,lease_until);
CREATE TABLE content_outbox (
  event_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  available_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  acknowledged_at INTEGER,
  UNIQUE (aggregate_id,aggregate_version,event_type)
);
CREATE INDEX outbox_due ON content_outbox(acknowledged_at,available_at,event_id);
CREATE TABLE content_control (
  key TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json))
);
CREATE TABLE content_run_log (
  id TEXT PRIMARY KEY,
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
  story_version INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  PRIMARY KEY (run_id,story_id,story_version)
);
```

Run summaries consolidate `observer_runs`, trial/global ledgers under `kind`, preserving original ID and all original fields in JSON; a mapping manifest disambiguates IDs if historical source ledgers collide. Add versioned compatibility views/adapters for existing admin statistics. Do not discard observer relationships.

Candidate fingerprints are indexed, **not globally unique**: multiple independent sources reporting the same fact are valuable corroborating evidence. Video IDs are globally unique and teams are associations; shared channels are fetched once. Story entity indexes narrow likely matches, but cannot arbitrarily exclude clusters the old algorithm would merge; compare against complete eligible-window reference results.

Benchmark every index: secondary indexes increase D1 write metering. Long substring searches (`q`) need compatible escaping and bounded validation; D1 limits LIKE/GLOB patterns, so exact existing arbitrary-query semantics may require application substring filtering over a measured bounded page of candidates, not truncating the user's query. No query search behavior change is authorized by this plan. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## PostgreSQL bridge migrations proposed

Reserve `db/migrations/053_content_integration_bridge.sql` **only if that number remains free at implementation time**. Add:

- `content_publication_refs(id TEXT PRIMARY KEY, kind TEXT, team_id TEXT, publication_date DATE, version INTEGER, content_hash TEXT, published_at TIMESTAMPTZ)`; public identity metadata only.
- `content_integration_receipts(event_id TEXT PRIMARY KEY, aggregate_id TEXT, aggregate_version INTEGER, processed_at TIMESTAMPTZ)` for exactly-once database effects under at-least-once requests.
- A versioned integration cursor/outbox for public schedule changes and next-delivery wakeup hints; no copied editorial raw bodies.
- Backfill existing edition refs using a server-side INSERT/SELECT. Add a new FK from `three_and_out_push_deliveries.briefing_id` to refs; validate before removing the old snapshots FK in a later controlled phase. Preserve rows, daily uniqueness, legacy-null delivery dates and original IDs. Keep old snapshots during the rollback window.

Reserve `054_content_delivery_due.sql` for optional indexed `next_due_at`/wakeup publication and durable retry work. Preserve existing user preferences, consent and delivery-time semantics. Reserve `055_content_writer_fence.sql` for durable writer ownership epoch if not included in 053. Do not alter existing migrations; introduce new forward-compatible migrations. Final schema must be reviewed against the production catalog once available.

## Migration phases, tests and rollback

| Phase                     | Actions and dependencies                                                                                                                                                                                                    | Tests / acceptance                                                                                                                                                          | Rollback                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0: Baseline               | Recover read-only production access; enumerate real tables/columns/indexes/FKs/extensions, exact eligible data counts and aggregate sizes. Check all consumers and effective plan.                                          | No unmapped columns/FKs; production/local data distinguished; export egress + target storage budget agreed.                                                                 | No data changes. Stop if quota recovery requires an unapproved paid action.                                                                                          |
| 1: Adapter                | Add content interface/Postgres adapter; default existing owner; move read-side enrichment writes into explicit job code after parity tests.                                                                                 | Old API snapshots, sorting/search, notifications, schedule enrichment and all 32 team fixtures pass.                                                                        | Disable new read flag; existing PG repository remains.                                                                                                               |
| 2: Local D1 qualification | Add D1 schema under `workers/content-engine/migrations`; transform sanitized fixtures and a later authorized bounded source export.                                                                                         | SQLite constraints + local D1 query semantics; production-Free CPU/row-meter qualification later. Match IDs/records/relationships, full Film Room union and archive output. | Delete disposable local test DB only; no shared DB deletion.                                                                                                         |
| 3: Copy                   | After separate rollout authorization, apply additive bridge; pause/fence all content writers and editor mutations briefly, record epoch/watermark; one consistent PG snapshot export, dependency-order import and manifest. | Per-table counts, canonical normalized record hashes, orphan checks, edition uniqueness and sampled JSON equality all pass; all user rows unchanged.                        | Keep PG authoritative; drop no source tables. Restore old scheduler only after revoking new epoch.                                                                   |
| 4: Shadow reads           | PG writer remains owner; resumable changes feed updates D1 shadow. Alternatively use repeated controlled freeze/delta capture; no informal timestamp-only CDC.                                                              | All inserts/updates/deletes/source edits and evidence relinks captured; shadow comparisons cause no notifications/providers calls.                                          | Shadow flag 0; PG remains source.                                                                                                                                    |
| 5: Read canary            | KC, SEA, then all teams; separate read flag per team; preserve canonical writes in PG until writer switch.                                                                                                                  | Golden responses, cache/private isolation, mobile contracts, empty/errors and expected status codes match; cost headroom holds.                                             | Read flag PG, provided replica is caught up; purge affected public cache.                                                                                            |
| 6: Writer cutover         | Freeze old writer and admin mutation routes; reconcile final delta/tombstones; verify manifests; advance ownership epoch; enable D1 scheduler, outbox and PG consumers.                                                     | Old writer rejects stale epoch; one owner; no duplicate story/version/delivery; no missing source health or user notifications.                                             | Pause D1 writer, export/replay **all post-cutover changes** back into PG, reconcile, advance epoch, then resume PG writer/read flags. Never simply flip writes back. |
| 7: Soak/archive           | Keep legacy PG editorial graph read-only through at least 14 days including a game-day peak; obtain retention approval separately.                                                                                          | Rollback drill, correction/takedown, quota failure and restore tests; stable 7-day trend and projected month.                                                               | Source data retained. Destructive pruning is a separate authorized task, not part of this plan.                                                                      |

Timestamp-only copying is insufficient: same-timestamp changes, evidence association changes, deletions, source-name updates and retry receipts need durable ordered revisions/tombstones. To keep initial complexity low, use a controlled content-write freeze for the initial copy and final cutover; user/account operations stay available. If uninterrupted editorial writes are required, add an explicit PG editorial outbox before copy and include its resource cost.

## Copy/import budget and recovery

Export only editorial tables and the necessary public schedule projection, never a full production database or user dump. Use one consistent snapshot and keyset pagination with a resumable encrypted local manifest; avoid long snapshots holding compute awake. Count downloaded bytes against Neon transfer. Import parents first: sources/registry, candidates/team associations, stories/entities, evidence, versions/decisions/overrides/events/cards, editions, observer records and derived projections. Do not replay old outbox events as new user notifications; seed receipts/high-watermarks.

Convert payloads without loss, including old nullable briefing dates and rejected/review records. Retain historical jobs and statuses for audit, but migrate `RUNNING` jobs as recoverable only after old workers are fenced; preserve attempt count and idempotency keys. Count import rows and index writes against the daily D1 allowance; spread an import over multiple days if necessary. Migrations/backfills/shadow reads consume the same quotas as the serving application.

D1 Free has a 500 MB database limit and seven-day Time Travel. Use a projected **350 MB operating target**, 400 MB stop threshold, and 90-day growth forecast before starting copy. The account's combined storage does not enlarge one database. Large permitted raw bodies can be archived to optional R2 with checksums and retrieval adapters; evidence and search functionality must remain available. No automatic deletion to force a fit. [D1 platform limits](https://developers.cloudflare.com/d1/platform/limits/).

Before a real cutover, rehearse recovery from an outbox outage, concurrent evidence updates, malformed export, deleted story, queued work older than Queue retention and rollback with newly published content. Time Travel alone is not a cross-store backup; coordinate content watermarks with PG receipts and suppress external delivery replays during restore.
