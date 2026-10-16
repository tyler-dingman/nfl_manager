# D1 editorial proof-of-concept results

October 16, 2026 · **Local only; stop for review.**

The editorial repository is functionally validated on local Miniflare/workerd D1. It uses one shared database and preserves text IDs, editorial JSON, relationships and revision history. **This does not qualify a production $0 launch:** the modeled daily row workload fits the stated headroom, but 90-day storage exceeds the single-database limit and deployed Free Worker CPU remains unverified.

## Isolation and scope

Implementation is on local branch `poc/editorial-d1-local`, in separate worktree `/private/tmp/down-distance-d1-poc`, based on `c1b06d36`. All added files are under `workers/content-engine/`. The six architecture documents were read from the original working tree; none was edited. No Front Office, authentication, Parlay Lab, Trivia, PostgreSQL migration/table, production content route, existing scheduler, root package/lockfile or shared application module was changed by this task. No production database was opened and no existing content was exported, deleted, migrated or automatically imported. No Cloudflare account resource, paid infrastructure, paid AI, provider ingestion or deployment was activated.

The prototype deliberately omits production routing, discovery/synthesis, cron/Queue consumers and cross-store delivery. It provides explicit repository operations and durable jobs, not a second live engine. Worker HTTP returns 404 locally and refuses non-local hosts; invalid bindings return 503. The only configured D1 binding is `EDITORIAL_DB`, with a zero UUID sentinel and `remote=false`. Wrangler commands hardcode local migration/dev or dry-run build, reject forwarded remote flags, and run without application database or provider environment variables.

## New files

- `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.toml`, `.gitignore`, `.prettierignore`, `README.md`, this report.
- `migrations/0001_editorial.sql`: proposed editorial graph, 32-team reference IDs, source checks/checkpoints, CAS assertion table, indexes and initial writer-epoch control.
- `migrations/0002_candidate_revision_history.sql`: immutable per-candidate source revisions, retaining earlier text rather than overwriting evidence history.
- `migrations/0003_query_cost_indexes.sql`: measured reverse-lookup/feed/exhaustion indexes. Existing successfully applied migrations were not edited when adding these improvements.
- `src/{bindings,database,index,jobs,metrics,repository,teams,types,worker-repository}.ts`.
- `scripts/local.mjs`, `scripts/benchmark.ts`, `scripts/project.ts`.
- `test/{harness,fixtures}.ts`, `test/{repository,jobs,coverage,isolation}.test.ts`.
- `measurements/{pre-index-baseline,local-benchmark,free-tier-projection}.json`.

The lockfile pins Wrangler, Miniflare, Worker types, TypeScript, tsx, Node types and Prettier. Generated dependency/build/dev databases are ignored. The actual versions are in the lockfile; no account-global package installation is needed.

## Schema and compatibility

The three SQLite migrations implement the proposed schema from `DATABASE_MIGRATION_PLAN.md`: `content_sources`, `source_teams`, `content_candidates`, `candidate_teams`, `canonical_stories`, `story_entities`, `story_evidence`, `story_versions`, `story_publication_decisions`, `story_editorial_overrides`, `story_domain_events`, `editorial_cards`, `video_source_registry`, `film_room_videos`, `film_room_video_teams`, `three_and_out_snapshots`, `public_schedule`, `ingestion_jobs`, `content_outbox`, `content_control`, `content_run_log`, `observer_run_items`, and `observer_run_events`. Extra tables are `nfl_teams`, `source_checks`, `source_checkpoints`, `transaction_assertions`, and `content_candidate_revisions`.

IDs remain opaque TEXT, including original source/candidate/story/video/edition IDs. Relationships stay inside D1 with foreign keys; game IDs are logical references and the schedule table is only a future projection. JSON uses `json_valid`, booleans use 0/1 checks, positive versions are constrained, team associations reference the same 32 canonical lowercase team IDs used by the app, and source scoping cannot be absent unless explicitly national. Candidates are unique by source/external ID and source/canonical URL; fingerprints are indexed **without global uniqueness**, preserving independent corroborating publishers. Evidence additionally enforces that its source actually owns the referenced candidate. Version/decision/card relationships and one published team/date edition are constrained; legacy null edition dates remain representable.

Source definitions use a content hash to skip unchanged writes. Source checks preserve last attempt, last success, ETag, Last-Modified and cursor separately; late checks cannot regress checkpoints. Updated definitions preserve checkpoint scheduling. Candidate revisions preserve the original candidate identity/discovery time and earlier raw records, and atomically create revision-specific processing jobs. Unknown nested editorial fields and nulls round-trip. Indexed timestamps are UTC milliseconds; a later importer must deliberately preserve existing normalized ISO values and DTO casing in the retained domain JSON. This prototype is not a claim that current PostgreSQL records can be copied without a mapping adapter.

## Repository operations and atomicity

Implemented operations: source upsert/team selection; source check/checkpoint recording; candidate dedupe and material fingerprint revision; explicit draft canonical story creation; evidence association and source attribution; versioned publication with decision/card/entity projections/domain event/outbox; public team stories with national inclusion and keyset pagination; globally deduplicated video metadata with multiple team associations and availability filtering; sourced Three & Out publication/archive pages; run metrics; idempotent job enqueue, atomic claim, token/epoch-fenced completion, retry/dead state and expired-lease recovery.

SQL values use prepared statements and bound parameters. Dynamic SQL is limited to bounded placeholder lists and hardcoded benchmark table names. No PostgreSQL locks, callback transactions, user identities, credentials or private recipient data are involved. D1 `batch` wraps multi-table writes. A zero-row story CAS is followed by a constraint assertion on `changes()`; it aborts the entire batch rather than committing orphan versions/events. Candidate + revision + association + processing job are also one guarded batch. Publication requires owned evidence IDs for that story and an explicit positive publication decision for PUBLISHED state. Editions require three distinct eligible published story IDs and an atomic outbox record.

A job claim uses a single conditional UPDATE RETURNING within its batch, checking due time, attempts, epoch and expiring token lease. Each due branch selects at most one candidate using an index. Exhausted jobs use a partial index and explicit eligible statuses, so retained DEAD history does not become a full scan. Reclaimed work receives a new token; an old token cannot complete or fail the current lease. Epoch changes fence old claims/completions. This is local ledger fencing, not a completed production writer-cutover protocol or scheduler.

## Automated validation

**22 tests pass** against real local D1 APIs. Coverage includes all 32 teams for sources, national stories, multi-team Film Room and published editions; original IDs/nested fields/nulls; duplicate URLs and independent publisher fingerprints; revised source text history; multiple-source corroboration/attribution; publication versions and concurrent zero-row CAS rollback; a late SQL failure after CAS; a late candidate-job failure leaving no candidate/revision/association/job; drafts/unavailable/private content; pagination and tie ordering for stories, videos and editions; legacy-null edition dates; missing/invalid teams; SQLite FK/JSON/boolean/version constraints; input/query budgets; duplicate and concurrent job claims; lease expiry, stale completion/failure, retries, poison/exhausted jobs, writer epochs, retained DEAD history; persistent restart recovery; and local-only command/import isolation.

`npm run typecheck` passes. `npm run build` passes as a Wrangler dry-run bundle; it does not upload or deploy. Local Wrangler migrations 0001–0003 apply successfully, and repeat application reports no pending migration. A localhost dev smoke check returned the expected 404 with the D1 binding marked **local**. No web/native screens or app APIs changed, so no application UI/device validation is claimed. Tests remove only their own disposable synthetic temporary databases; the empty migrated local dev database remains under ignored `.local/state`.

Initial experiments exposed malformed SQLite version checks and obsolete persistence options; both were corrected before qualification. Persistent restart is explicitly tested using Miniflare's current `resourcePersistencePath`. The installed Miniflare beta's supported v4 conversion helper is used; runtime/toolchain upgrades require rerunning these tests. No test runner fallback to plain SQLite or an in-memory fake was used.

## Local measurements

Reproduce with `npm run benchmark` followed by `npm run qualify`. Fixture size: 163 sources (97 RSS including one national source and 66 video sources), 660 stories, 960 video IDs and 32 published editions. Articles use roughly 8.6 KB of synthetic candidate JSON. Source text is never fetched. The benchmark creates all fixture records, measures repeated reads/duplicates, and performs 32 revision/claim examples. It is a warm local sample, not a production-size export or p99 guarantee.

| Table                         | Synthetic rows |
| ----------------------------- | -------------: |
| `content_sources`             |            163 |
| `content_candidates`          |            660 |
| `content_candidate_revisions` |            692 |
| `canonical_stories`           |            660 |
| `story_evidence`              |            660 |
| `story_versions`              |          1,320 |
| `editorial_cards`             |            660 |
| `film_room_videos`            |            960 |
| `film_room_video_teams`       |          1,920 |
| `three_and_out_snapshots`     |             32 |
| `ingestion_jobs`              |            693 |
| `content_outbox`              |            692 |

D1 local `meta.size_after`: **16,367,616 bytes (16.37 MB)** including SQLite tables/indexes. Retained JSON payloads total 13,492,868 bytes; the sample physical/JSON ratio is 1.213. This ratio is not a production compression or billing factor. Empty schema size and all timing samples are recorded in the measurement JSON. Representative response JSON: stories 9,226 bytes, video page 6,925, edition page 270.

| Operation             | Statements/call | Local rows read/call | Local rows written/call | p50 wall ms |
| --------------------- | --------------: | -------------------: | ----------------------: | ----------: |
| `candidate.new`       |               8 |                 2.00 |                      22 |        7.37 |
| `candidate.duplicate` |               1 |                 2.00 |                       0 |        1.68 |
| `candidate.revision`  |               8 |                 7.00 |                      20 |        7.94 |
| `story.new`           |               3 |                 0.00 |                      12 |        2.83 |
| `evidence.new`        |               1 |                 0.00 |                       5 |        1.37 |
| `story.publication`   |              10 |                 5.50 |                      28 |        7.74 |
| `source.check`        |               3 |                 4.00 |                       7 |        2.91 |
| `video.upsert`        |               4 |                 0.00 |                      10 |        3.47 |
| `edition.publish`     |               4 |                 7.00 |                      12 |        3.44 |
| `read.story.page`     |               1 |                22.00 |                       0 |        1.70 |
| `read.story.cursor`   |               1 |                41.97 |                       0 |        1.69 |
| `read.video.page`     |               1 |               180.97 |                       0 |        1.68 |
| `read.edition`        |               1 |                 1.97 |                       0 |        1.50 |
| `read.attribution`    |               1 |                 4.00 |                       0 |        1.53 |
| `job.enqueue`         |               3 |                 4.00 |                      10 |        4.35 |
| `job.claim`           |               2 |                 9.00 |                       5 |        2.06 |
| `job.complete`        |               3 |                 4.00 |                       8 |        2.75 |

Rows are the returned **local D1** `meta.rows_read`/`rows_written`, not result counts. Index amplification is included by the local runtime. Production Free-plan metering and any account-wide usage remain unverified. These calls execute repository orchestration in Node with D1 served by local workerd. Node host CPU measurements exclude the workerd process and are **not Worker CPU measurements**. For example, publication p99 wall time was 32.88 ms and p99 host CPU 19.36 ms; neither proves a Free Worker CPU pass or failure.

Measured tuning: publication reads fell from 334.5 to 5.5 rows/call; new-video association replacement from 959 to 0 on this dataset; average job claims from 2,037.5 to 9; story-page averages from about 54 to 32 across first/cursor pages; video page from 356 to 181. Added indexes increase writes, e.g. publication from 26 to 28 and video upsert from 8 to 10. Query plans are saved. Video pages still sort/filter the team's associated catalog and read roughly three rows per association; deep pages/full catalogs need further scale testing. The prototype does not silently truncate the production Film Room contract because no existing route is switched.

Typical new-candidate → draft story → one evidence → publication is **22 SQL statements** across operations, including revision/job creation and outbox. With the allowed maximum 32 team/entity/evidence associations, combining whole stages can exceed Free's 50-query invocation limit (roughly 115 statements for the largest combined path). Individual operations are bounded, but a future dispatcher must split durable stages and recalculate job/Queue costs; local batches alone do not establish an invocation budget. Hashing/serializing 512 KB records, feed parsing, clustering and full-catalog rendering are additional CPU risks not qualified here.

## Free-tier feasibility

Published Cloudflare D1 Free allowances checked against official documentation: 5 million reads/day, 100,000 writes/day and 5 GB account-wide storage; index writes count and scanned rows matter. Limits reset daily, not monthly. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

One Free D1 database is limited to 500 MB, with 50 queries per Free Worker invocation, 100 bound parameters/query and 2 MB row/string/blob limit. The aggregate 5 GB account allowance does not enlarge this single editorial database. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

Workers Free currently lists 100,000 requests/day and 10 ms CPU/invocation; the earlier design's p99-under-8-ms goal remains a qualification target. There was **no deployed Free CPU test or account telemetry access**. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

The reproducible projection retains the architecture plan's assumptions: 1,040 checks/day, 200 new/revised candidates, 80 changed stories, 40 video updates, 32 editions, 1,400 jobs, 128 downstream operations, 20,000 public requests/day, 90% cache hits and 150 assumed rows/origin read. Clustering assumes 500 rows/candidate because it is not implemented. A 25% reserve covers retries; 24,000 Worker invocations/day is still an assumption. Bridge costs and cache behavior are not measured. The write model deliberately overcounts some candidate-job enqueue writes for conservatism.

- Projected reads: **536,920/day**, below the 3.5M operating target for this scenario.
- Projected writes: **61,840/day**, below the 70k target but with limited headroom for richer associations, extra processing stages or other account workloads.
- Estimated retained growth: **6.03 MB/day**. This combines measured payload means, 500-byte job and 300-byte check allowances, 10 KB editions, candidate revision preservation and the synthetic storage ratio. It is not a measured multi-day production growth rate.
- Including the sample starting size: **197.2 MB at 30 days**, **558.8 MB at 90 days**. The 350 MB operating target is reached in roughly **55 days**, the 500 MB cap in **80 days**, before any unknown real import.
- Merely changing version records to the plan's 12 KB assumption raises the 90-day estimate to **659.4 MB**; larger canonical/outbox payloads raise it further.

**Assessment:** daily row quotas appear plausible for a small bounded workload, but this retained-history model fails the 90-day single-database storage gate. Worker CPU, complete production contracts and the rest of the application's $0 hosting/Neon costs are unqualified. No automatic retention deletion, paid upgrade, R2, Queue or split-per-team database was introduced to make the forecast fit. Published Free limits can reject work at exhaustion; they do not guarantee unchanged freshness under arbitrary load.

## Remaining migration risks

1. No production schema/data inventory or source export was performed. Existing PostgreSQL column drift, exact timestamp/boolean/enum conversions and record-size distributions remain unmapped. Source/candidate/story/edition IDs must be checked byte-for-byte in a later authorized rehearsal.
2. A later adapter must match current filters/search/sort ordering, full Film Room curated/discovered union and availability messages, story detail/saved links, edition archives and source attribution. This POC's keyset pages are not a replacement public API. No production API parity is claimed.
3. Source normalization, entity clustering, material-change logic, synthesis and provider quotas/retries were not moved. Candidate fingerprints and publication decisions are explicit trusted inputs. Generating real sourced stories requires those rules and evidence validation, not synthetic fixtures.
4. Candidate history and outbox duplicate some bodies intentionally for lossless recovery. Long-term storage requires a separately reviewed compact/reference/archive design with restoration and rights checks. No data was pruned.
5. Publication outbox is durable locally, but no PostgreSQL publication-reference bridge, idempotent notification/search consumer, recipient timing change or cross-store rollback exists here. Job epochs are not a complete global writer fence. Cross-store atomicity cannot be assumed.
6. A prospective Free deployment needs separate authorization and real p99 CPU, row-meter, worst-input, full-catalog, multi-stage query, seven-day/busy-day and quota-headroom tests. Beta runtime/toolchain behavior must be pinned and revalidated. Provider limits and account-wide quotas remain unverified.
7. Under sustained failures, exhausted/retry index size, evidence histories, source-check logs and outbox backlog can grow indefinitely. Tests cover retained DEAD history and stale tokens, not indefinite capacity. No lifecycle deletion policy is activated.

## Recommended next steps and rollback

Review this isolated branch first. Keep existing PostgreSQL editorial ownership and existing scheduler unchanged. Resolve the storage lifecycle and invocation/CPU stage boundaries on synthetic worst-case inputs before considering infrastructure. Next, design compatibility adapters and lossless mapping fixtures; only after separate authorization consider a bounded Free qualification deployment with no production traffic. Production export, writer fence, bridge, shadow, canary and final migration are later independent gates from the six architecture documents.

To reject the POC, leave the branch/worktree unused; no application rollback is necessary because nothing references it. Do not delete any existing database/resource. Local build/test artifacts are ignored and disposable; retain committed migration/measurement evidence for review. Once a future system accepts real writes, a read-flag flip alone would not be a valid rollback: it would require fenced replay of accepted versions/outbox events into the prior owner.
