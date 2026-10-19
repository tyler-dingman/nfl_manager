# Content engine capacity report

**Result: write and storage workload reduced, Free-tier capacity still FAIL. Multi-D1 routing remains disabled.**

Baseline `eb8af327`, isolated branch `poc/content-engine-free-optimization` in `/private/tmp/down-distance-staging-preparation`. Assessment dated 2026-10-19. No production access, deployment, billing activation, remote resources, PostgreSQL or R2 were used. Existing rollback implementations and migration history remain intact.

## Required results

| Metric | Before | After |
|---|---:|---:|
| Measured source-account writes/day, including preparation and cleanup | **392,896** | **343,972** |
| Measured source-account reads/day, including preparation and cleanup | **6,534,711** | **570,606** |
| Monitored Worker HTTP request maximum | **65 queries** | **39 queries** |
| Complete cold correction HTTP request maximum | **62 queries** | **28 queries** |
| Canonical processing + correction writes | 9,608 | 7,298 |
| Post-cleanup encoded payload bytes | 5,047,373 | 1,584,622 |
| Post-cleanup database physical bytes | 15,474,688 | 10,309,632 |

Writes fall **12.5%** including maintenance; canonical processing/correction writes fall **24.0%**. Encoded payloads fall **68.6%**, including elimination of registry-clock orphans, not just canonical compaction. These are matched synthetic workload measurements, not production percentages or annual forecasts. UUID/compression/page allocation produces small run-to-run size variation.

Capacity at 50 DAU: **FAIL**. The explicit measured-unit model gives **348,022 writes/day** before additional unmodeled demand. Even zero DAU exceeds the 100,000 account allowance and 70,000 target. No sustainable DAU is certified. Published [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/) were checked: account-wide quotas remain shared, index writes count, and Free permits 50 queries per invocation. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/) constrain hosted CPU; local wall time cannot certify that limit. Account headroom was not accessed or assumed.

## What the 24-hour measurement covers

[Before](reports/content-engine-capacity/day-before.json), [after](reports/content-engine-capacity/day-after.json), complete request ledgers and [capacity model](reports/content-engine-capacity/capacity.json) are committed. The replay dispatches actual **local workerd HTTP requests**, with real D1 SQL metadata and fresh per-request object/storage contexts. It executes application `processSource`, `processCandidate`, normalization, deterministic grounded synthesis, publishing policy, canonical/public publication, search, source jobs, odds and precomputed research persistence. It does not derive daily demand solely by multiplying isolated adapter costs.

The virtual day is Monday 2026-10-19 UTC:

- All 120 monitoring registry definitions, including all 32 teams; the existing enablement policy selects **97 active RSS sources**. Their configured intervals are 32×300 seconds, 64×600 seconds and 1×1,200 seconds: **18,504 checks/day**. Registry synchronization every 30 minutes is an explicit replay assumption, not an assertion about a deployed Cron Trigger.
- 96 new candidates create 96 canonical articles across 32 teams. All receive one correction, yielding two retained versions each. The fixture does not impose a two-version implementation limit. The preceding planning model's four-version workload would add demand; no unsupported saving from fewer required corrections is claimed.
- 2,208 duplicate feed revisits preserve existing candidate identities and create no new candidate jobs. The remaining unchanged visits return empty/not-modified fixtures. Real conditional-fetch behavior is separately covered by existing fetcher tests. Upstream fetching is injected/stubbed and outbound networking is blocked; no real NFL feed was fetched.
- Source enqueue, lease/claim and completion use the real durable job adapter. All 18,600 current-day jobs finish. Two additional historical synthetic completed candidates/jobs begin six/eight days old and are seven/nine days old at cleanup; both are archived and retired at the approved inclusive boundary.
- 32 Three & Out publications use three actual created article IDs each. Email is not sent.
- At the actual Monday 15:00 UTC refresh slot, 16 events each publish 2,000 markets. **Real `computeTrendingProps`** executes and its results are persisted; scores are not fabricated. Historical-reference packs are empty in this scenario, so full mature-history research demand is explicitly unqualified. Existing scoring tests cover research correctness separately. The Monday/Wednesday/Saturday cadence is unchanged; this is a refresh-day envelope rather than a weekly average.
- Encrypted full SQL export, read-back/decryption, complete isolated D1 restore, table/FTS-rowid digest comparison and FK validation run before retention deletion. Bounded retention steps and verified payload GC then execute. Two eligible candidates and only verified unreferenced objects are removed; no real user/editorial data is present.

There are **24,527 fixture HTTP requests** including diagnostic/aged-fixture setup calls, and 24,521 application workload calls. Diagnostic reads and 50 aged-fixture setup writes are excluded from the daily account totals above. Cold initial registry creation is conservatively included. Owner preparation/cleanup is charged to the same planning day rather than taking free quota credit from the UTC boundary.

### Scope limits

This is a complete day of the specified **monitoring RSS/per-job pipeline**, not a production traffic observation or a replay of every provider. Separate video-provider ingestion, provider failures/bursts, mature historical datasets and notification audience fanout remain additional demand. Observer mode suppresses follower notifications; a live launch would add their writes. No real email or AI provider is invoked.

The synthetic entry is in `workers/content-engine/test/content-day-worker.ts`, with no Wrangler deployment reference. The driver supplies bounded per-source/per-job invocations. The existing all-source global automation API still loops registry sync/job work in a single request; that orchestration is **not qualified** by a 39-query per-job result. It needs durable continuation before enabling production ingestion. The API budget guard now fails closed rather than issuing a 51st statement. Local Miniflare measurement runs intentionally record the old over-budget paths; they do not demonstrate a successful deployed Free-plan day.

## Subsystem costs

| Subsystem | Requests | Rows read after | Writes before | Writes after | Peak queries before → after |
|---|---:|---:|---:|---:|---:|
| registry | 5,761 | 18,002 | 46,202 | 1,082 | 13 → 14 |
| source-poll-and-jobs | 18,504 | 447,456 | 334,704 | 334,704 | 31 → 31 |
| editorial-processing | 96 | 6,474 | 5,476 | 4,321 | 65 → 39 |
| corrections | 96 | 5,859 | 4,132 | 2,977 | 62 → 28 |
| odds | 16 | 448 | 416 | 416 | 36 → 36 |
| lab-scores | 16 | 294 | 112 | 112 | 19 → 19 |
| three-and-out | 32 | 288 | 320 | 320 | 11 → 11 |

The dominant unchanged subsystem is **source polling plus its job lifecycle: 334,704 writes/day**. Conditional requests avoid duplicate content processing but do not remove durable scheduling writes.

The complete day reconciles exactly as follows:

| Polling component | Accounted writes/day |
|---|---:|
| 18,504 ordinary checks × 18 writes | 333,072 |
| 96 new candidate payload/identity writes × 11 | 1,056 |
| 96 candidate-processing job enqueues × 6 | 576 |
| Total source polling + jobs | **334,704** |

An ordinary check performs four business mutations: enqueue, claim, source-success/checkpoint update and completion. Their four fenced transactions add eight guard mutations. The current indexed SQL layout reconciles six additional accounted writes, giving 18 total. Thus even ignoring every guard/index, four business mutations per check already require **74,016 writes/day**, above the 70,000 target before publishing anything. Guard removal would sacrifice maintenance safety and still would not solve the target.

`rows_written` is actual local D1 metadata, including its index accounting. It is not physical disk-I/O measurement or a production billing certificate. The business/fence/index decomposition reconciles the measured total using the schema; it is not an independent index-page trace. Transaction statement counts remain distinct: a batch with ten statements is ten queries. No indexes were removed speculatively.

## Implemented changes

### Bounded immutable preparation and atomic publication

Publication now stages immutable JSON objects in memory, hashes them, batches existing-object prefetch, and shares a bounded inline payload-reservation transaction. The transaction accounts only for newly missing hashes, respects the unchanged 64 MB admission ceiling, and serializes concurrent deduplication. Payload bytes are read back and SHA-verified before visible publication. Legacy/incomplete/chunked objects keep their existing verified path.

Canonical head/version, evidence/decision/event rows, public head/history, FTS and outbox statements still commit in **one guarded publication transaction**. Prepared immutable objects can become harmless GC candidates if a later CAS fails, exactly as before; no public partial publication is accepted. Public CAS preconditions are combined with the canonical guard in the same transaction, removing redundant assertion rows without weakening the public version check. A real raced-public-version test verifies that the winner and FTS survive a stale commit attempt.

Measured cold correction requests improve **62→28 queries**. Candidate-processing requests improve **65→39**; their full service/job envelope still exceeds the under-30 target. Odds publication peaks at 36. The API Worker shares a 50-statement reservation counter across its DB wrappers; oversized batches are rejected before dispatch and concurrent branches cannot over-reserve. The limit error is a generic temporary-unavailability response, not a user-facing SQL detail. This is protection against overflow, not evidence every possible large payload can finish in one request. Oversized/chunk-heavy or very large evidence graphs still require resumable preparation qualification.

### Shared canonical bodies and compact revision references

Large canonical prose is content-addressed separately from changing metadata. Canonical heads and synthesis envelopes share identical prose bodies; compact revision envelopes point to the immutable head and synthesis data rather than embedding another full story. Fields, claims/evidence IDs, original IDs and all required versions remain available. `revisionByVersion` reconstructs new envelopes and reads legacy full-copy envelopes.

Batched evidence resolution replaces redundant candidate/source lookups while validating candidate/source identities. Source attribution is preserved. Existing public API contracts and legacy object readers remain supported; no existing object is rewritten or history truncated. GC now checks nested `bodyHash` dependencies before deletion. Synthetic tests restore every original revision and attribution, then perform a new write with the restored epoch/capacity ledger and verify exact byte accounting.

### Stable source definitions and unchanged-content processing

Registry hashes previously included a new wall-clock `nextCheckAt` each synchronization. That created orphan immutable source copies and rewrote the SQL source head even when configuration was unchanged. Runtime validators/checkpoints now remain authoritative in SQL while immutable definitions normalize runtime clock fields. Sync compares both hash and projected SQL metadata; a drifted team/priority/enablement projection is reconciled, not silently accepted. Explicit force/schedule behavior remains available.

Registry writes improve **46,202→1,082** in this cold day; all later unchanged registry syncs write zero. Conditional ETag/Last-Modified support and 304 handling already existed and remain intact. Existing duplicate-candidate preflight, unchanged Lab Score detection and conditional status updates remain enabled. No polling interval was lengthened without evidence that coverage could tolerate it; no sportsbook refresh was removed. The remaining polling lifecycle needs a different durable protocol, not guessed source freshness or deletion of recovery history.

### Keyset owner export and retention snapshots

Full export and frozen-snapshot preparation used repeated `LIMIT 100 OFFSET ...` scans, revisiting prior rows on each page. They now use indexed rowid/keyset cursors and full composite primary keys for `WITHOUT ROWID` tables. Negative FTS rowids and binary data are preserved; reserved cursor-name conflicts fail closed. Restored snapshots compare exactly, including FTS rowids.

On the same complete optimized day, source-side preparation falls from 5,307,717 reads before this scan change to **68,826**; the fully original baseline costs 5,988,237. A separate multi-page fixture covers 2,000 jobs, 300 composite-key references, 500 negative FTS rows, quoted/semicolon content and binary objects, with a verified encrypted full restore. This removes the newly measured read-quota failure without changing retention windows or recovery requirements.

## Cleanup, storage and recovery

The original day creates 5,738 unreferenced objects; bounded GC removes 500, leaving a substantial backlog. The optimized day has only the two expired candidate objects, and verified GC removes both. No unverified duplicate cleanup or saved-article removal is credited.

Physical DB growth after cleanup is **13,225,984→8,069,120 bytes** in the matched day, about 39% lower. The physical end sizes include the approximately 2.24 MB schema/base state. Page allocation is measured via D1 metadata; releasing encoded bytes is not assumed to compact every SQLite page. No `VACUUM` or automatic annual physical-size claim is made. The 68.6% encoded saving includes registry-orphan elimination and cannot be attributed solely to canonical bodies.

After optimization, owner preparation adds 8 writes and bounded cleanup adds 32 writes/22,959 reads. Two retention clusters are retired only after a **complete verified archive restore**. Required articles, source attribution and corrections are kept. Original retention policy remains 90/7/30 days with permanent saved-reference exceptions.

The optimized encrypted full archive is **11,277,916 bytes**, two copies **22,555,832 bytes**, for this one-day fixture. Backup/restore verification is owner-local and uses no R2. A hypothetical emergency import into D1 additionally costs **80,893 writes and 62,833 reads** for this fixture, with ingestion paused. These are separately measured recovery operations, not free work. They do not establish that a mature multi-month import fits a daily allowance. Full historical backups and permanent job/audit growth remain long-term capacity risks; no unimplemented incremental/rotation savings are credited.

The existing owner backup procedure retains its separate-key encryption and frozen-write requirements. This benchmark uses disposable synthetic keys and temporary archives, then deletes its test state. Restored PREPARING/fenced state must be explicitly reconciled in an isolated target before reopening writes; restoration is not an automatic unlock. Hosted RTO and Worker CPU remain unmeasured. A daily backup implies a planning RPO of up to 24 hours, not continuous recovery.

## Rebuilt capacity model

The inherited 67,711 fixed-write intercept and 88,166/125,962 planning/sensitivity values are **not reused as measurements**. Background costs come from the complete day; source preparation/cleanup comes from actual metadata. User unit costs come from successful actual local API/auth HTTP samples, with explicit frequency assumptions in `scripts/project-content-engine-capacity.py`:

- Four identity checks, two logins/two logouts and 0.1 new accounts per DAU/day.
- Four home reads, two saved-list reads, one saved mutation, two content-state updates, 0.2 preference updates and 0.5 Front Office saves per DAU/day.

| DAU | Reads/day | Writes/day | Fixture + client HTTP requests/day | Result |
|---:|---:|---:|---:|---|
| 0 | 570,606 | 343,972 | 24,527 | FAIL |
| 25 | 574,249 | 345,997 | 24,972 | FAIL |
| 50 | 577,891 | 348,022 | 25,417 | FAIL |
| 100 | 585,176 | 352,072 | 26,307 | FAIL |

These DAU rows are **measured background + modeled activity frequencies**, not four full user-population replays. They omit additional notifications, video, heavy research, user storage growth and some internal service requests. Storage fields are explicitly background-day measurements, not whole-product DAU forecasts. They cannot establish positive headroom. The lower-bound failure is already conclusive at zero users. Reads now fit the published allowance for this scenario; writes do not. Multi-D1 would not multiply either account quota.

## Validation and reproduction

- Full root suite: **1,072 passed, 0 failed, 2 pre-existing skips**.
- Full Worker/D1 suite: **143 passed, 0 failed**. Includes editorial, authentication persistence, Parlay, no-R2 runtime, retention, corruption/recovery and five new optimization/integrity tests.
- Post-keyset retention/optimization rerun: **8 passed**; final projection/budget/restore-integrity rerun: **5 passed**. These overlap the full suite and are not counted again as unique tests.
- Actual local workerd password integration: **PASS**, 16 recorded auth samples plus channel-preference checks, native PHC verification, concurrent sessions, logout, expiration, reset/single-use rejection and restart. Encrypted user/preferences/Front Office/saved-bet/FTS/payload restore compares exactly and rejects tampering.
- Browser: **48 routes passed** with desktop/mobile-web widths and KC/SEA themes. No native screen changed; no Android/iOS device validation is claimed.
- Full-day baseline and optimized recovery comparisons: **PASS**; 32-team/96-story/version/request/subsystem assertions pass. Multi-page keyset/archive fixture passes. TypeScript completion check passes.

Unique full-suite total: **1,215 automated tests passed**, zero final failures. Earlier runs encountered temporary disk exhaustion and a repeated local auth-probe connection reset. Only reconstructable temporary npm cache was removed for disk space. The auth probe's synchronous owner CLI calls could outlive its pooled keep-alive socket; fresh loopback connections fixed the reset without automatically retrying ambiguous POSTs. Output directories are now prepared by the probe. No password hashing/security setting changed.

Evidence: `reports/content-engine-capacity/`, including `d1-all-tests.log`, root logs, final optimization/retention logs, auth/restore JSON, browser-final results and complete day request ledgers. Historical milestone reports are restored unchanged.

Reproduce from the isolated worktree with DATABASE_URL absent:

```sh
TSX_TSCONFIG_PATH=tsconfig.test.json DD_DAY_BASELINE=true node --import tsx scripts/replay-content-day.ts
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/replay-content-day.ts
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/test-content-maintenance.ts
python3 scripts/project-content-engine-capacity.py
```

Baseline mode loads the original editorial adapter and owner snapshot/export modules from `eb8af327` into temporary sibling files and removes them afterward. Both modes use the same synthetic scenario. Local sockets need execution permission; no Cloudflare credentials are required. Existing `qualify-staging.py`, `qualify-staging-workers.mjs`, no-R2 browser and auth scripts supply the broader regression checks.

## Remaining blockers and recommended next action

1. **Replace the per-poll three-transition job record + source checkpoint design with a qualified durable batched poll/cursor protocol.** Preserve leases, idempotency, crash recovery, source evidence and existing job history; do not simply remove guards/audits or slow the configured feeds. The unchanged subsystem alone costs 334,704 writes/day. It must be redesigned and replayed to reach 70,000.
2. Add durable continuation for the all-source global automation endpoint; the bounded fixture request model is not a production scheduler implementation. Large/chunk-heavy publication contexts also need resumable preparation, not a claim that budget rejection equals feature completion.
3. Define and validate bounded operational-history lifecycle and mature backup/restore costs. Current completed source jobs grow by about 18,500/day, outside the approved candidate/article cleanup rules. No new deletion policy is silently applied.
4. Replay mature reference datasets, notification audiences, separate video ingestion and upstream failure/burst cases; measure hosted CPU only when an approved staging run becomes appropriate. Continue to keep ingestion/deployment disabled meanwhile.

The safe write, query, storage and scan optimizations are implemented and tested. **The 50-DAU Free-tier objective is not met. No routing, deployment or paid infrastructure is authorized by this result.**
