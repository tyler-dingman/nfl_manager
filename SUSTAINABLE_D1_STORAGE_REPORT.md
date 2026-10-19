# Sustainable D1 storage — implementation and measured limits

Baseline `acba3ede`; isolated worktree `/private/tmp/down-distance-staging-preparation`, branch `poc/sustainable-d1-storage`. Prepared 2026-10-19. **The 50 DAU / 365-day target is NOT achieved.** Safe reclamation and binary storage are implemented and tested locally. The revised inherited workload still exceeds Free D1 storage, and actual local route instrumentation exposes a separate per-invocation query blocker. No deployment, remote resource creation, account/production data access, paid activation or deletion of real user/editorial data occurred.

| Requested result | Result |
|---|---|
| Storage before | Equivalent fresh synthetic fixture: **3,461,120 bytes**, base64 chunks |
| Storage after | Equivalent fresh binary fixture: **3,059,712 bytes**, 401,408 bytes lower (11.60% of total file) |
| GC storage effect | Encoded reservations **990,916 → 792,758 bytes**; allocated file remained 3,059,712 bytes |
| Physical reclamation | **48 free pages / 196,608 bytes** became reusable; six replacement payloads reused existing allocation. **Zero file-shrink credit** |
| Annual growth before | Inherited unbounded 50-DAU demand **5,873,259,057 bytes** at day 365 |
| Annual growth after | Revised projected fresh-binary demand **4,345,587,537 bytes** at day 365; **not measured production growth** |
| Garbage collection | Reference-aware, fenced owner-local maintenance; bounded transactions, dry run, audit and reservation release |
| Retention policies | Expire already-expired inference caches without active leases; preserve permanent/user/editorial/odds histories |
| Estimated capacity | **No whole-product DAU certified**, including zero DAU under the inherited background workload |
| Admission limit | Still **64 MB encoded**. Increasing it would hide the storage problem; projected exhaustion remains ~7.18 days at 50 DAU |
| Tests | 1,198 automated passes; zero final failures; 48 browser routes; auth and recovery PASS |
| Recommended next action | Resolve the retained historical/derived-data contract and route query budget before considering deployment |

## What grows and what is actually known

The application writes durable structured rows plus compressed content-addressed payloads. Every logical table and text column is included in the collector's root inventory, including JSON containing hashes and FTS tables. A reviewed schema fingerprint makes unknown tables or changed root schemas abort collection until their reference contracts are reviewed. SQLite/FTS shadow tables and collector/payload internals are excluded; explicit recovery pins are added separately. Nested payload hashes, JsonTree children, aggregate envelopes, reference packs and saved metadata are traced recursively. SHA-256 verifies complete objects before a sweep.

| Write family | Inspected implementation / durable roots | Retention decision |
|---|---|---|
| NFL source ingestion | `editorial-ingestion`, source/candidate/story/evidence/job tables | Keep candidate evidence, source attribution and published relationships; failed uploads with no references may be collected |
| Editorial generation | Public/internal stories, versions, wire events, overrides, observer captures | Keep published versions and corrections; no arbitrary article TTL |
| Three & Out | Daily briefing payloads, summary JSON, mail jobs/subscriptions | Keep historical briefings and all references |
| AI | SharedInference, `app_ai_cache`, daily quota reservations | Existing response expiry is one day; expired entries with expired leases are reconstructable |
| Search | Public story projections and `app_search` FTS5 | Preserve historical search rows. Index dedup/obsolete-row deletion needs a validated product/source identity contract |
| Parlay Lab | Current scores, boards, markets, saved metadata and original IDs | Keep current scores and every saved betting reference/evidence |
| Odds | Publication envelopes, processing queue, board/history snapshots and JsonTree identities | Preserve historical snapshots: read-by-ID/page interfaces exist, so age alone does not prove eligibility |
| Front Office | Aggregate heads, routes, command receipts and nested reference bundles | Permanent active state and rollback/command history are roots; never expire by age |
| Background jobs | Mail/outbox, ingestion leases, token archives, observer and operational packs | Existing archival semantics remain. No unsupported terminal-job TTL or security-history deletion |
| Recovery | `app_storage_pins`, offline encrypted SQL exports, provider Time Travel | Pin explicitly declared live recovery objects. Never modify offline backups; unknown encrypted directories block collection |

The benchmark uses controlled synthetic payloads labelled with these categories, three distinct payloads per category and repeated identical writes to exercise deduplication. The labels do **not** represent observed category prevalence, real provider feeds or a complete application data import. Existing domain adapters and product behavior are exercised separately by regression and browser suites. This session did not access production, so precise annual percentages of essential, referenced, expired and orphaned real data **cannot be measured**. It would be misleading to infer them from an artificial fixture.

Inherited 50-DAU annual model contributions, **projected and partly inseparable**, are:

| Category | Share of previous annual D1 demand |
|---|---:|
| Saved evidence + identity/score/public payloads | 44.74% |
| Inherited editorial and other payloads, not separable in source model | 40.07% |
| Structured tables/indexes | 7.35% |
| Reconstructable AI responses | 4.07% |
| Odds historical snapshots | 3.41% |
| Front Office history | 0.31% |
| Private configuration/attachments | 0.04% |

This identifies the dominant unresolved aggregates; it does **not** establish that 84.81% is deletable. Orphan/duplicate annual rates are unknown and receive zero projected savings. Immutable hashes already deduplicate identical bytes; duplicate write attempts do not create new objects. Removing the wrong historical roots would break saved links, search, corrections, betting evidence or recovery.

## Reference-aware collection and concurrency safety

Migration **0040** adds nullable binary chunk data, a persistent write epoch/fence, transient transaction guards, explicit recovery pins and a deletion audit table. Migration 0039, original IDs, hashes, schema relationships and rollback tables remain intact.

The collector (`packages/storage/garbage-collection.ts`) is an **owner-local maintenance library**, with a local-only command wrapper. It is not enabled as a cron, public route or production Worker handler:

1. Require explicit acknowledgement that raw SQL writers/imports are stopped; acquire the persistent maintenance fence and advance the epoch. Check the reviewed logical root-schema fingerprint before any sweep; unknown schemas fail closed.
2. Inventory manifests and roots with bounded keyset reads; compare reservations against the exact manifest sum under the fence. Do not use increasing OFFSET scans over large root tables.
3. Select at most 500 expired inference keys with no active generation lease. Dry run considers the same planned expiry as an applying run; there is no invented editorial/odds TTL.
4. Decode and verify all complete payloads. Trace nested hashes, preserve every reachable object and explicit pin. Missing required pointers, incomplete rooted objects, corrupt chunks, unknown opaque SQL values and unknown encrypted recovery envelopes abort collection. Known rooted encrypted mail is a leaf under its existing mail contract; unrooted encrypted envelopes are not guessed to be disposable.
5. Only after verification may eligible cache roots expire. Sweep up to the explicitly requested bounded run limit (default five, maximum 500 objects). **Each object's chunks, manifest, counter release and audit insertion are one four-statement D1 transaction.** Partial/unreferenced admissions can be reclaimed; roots and permanent user rows cannot be deleted by this collector.
6. Release the fence. Interrupted maintenance leaves it locked if the process dies; there is no automatic lease expiry that could allow two sweepers to overlap.

`D1Objects` shares a request-scoped fenced SQL adapter with `Storage`. The adapter captures its epoch before reading/uploading and adds an epoch/lock guard to every write transaction. A request that uploads a payload, pauses across GC, then attempts to publish a head fails atomically and must retry from a fresh request. Requests started while the fence is held refuse writes. This prevents dangling publications after an orphan is swept. A failed original business transaction still rolls back normally. Reference discovery is conservative and can over-retain ambiguous hash-like text; encoded pointer formats require an explicit tracer/contract review rather than an assumption that regex can decode arbitrary opaque data. Guarded batches have at most 48 original statements plus two guard statements.

**Scope of the guarantee:** these fences protect the new D1 application SDK, including auth, user records, Front Office, editorial, Parlay and scheduler adapters tested here. They cannot stop a dashboard, old unfenced deployment, raw SQL client or external import. Stop those writers before maintenance. Do not run the collector alongside legacy R2/SQL tools against the same database. An owner acknowledgement is required; a public endpoint cannot simply assert it. Raw access is deliberately not treated as safe concurrent SDK traffic.

Recovery pins (`app_storage_pins`) are permanent unless explicitly removed by an owner under a validated recovery policy. Encrypted recovery manifests may hide child references, so an unknown encrypted object blocks the entire sweep rather than risking its restore chain. The new architecture uses independent encrypted full SQL backups; deleting a live orphan does not alter those offline copies. Old generic cold checkpoint code is retained for rollback/R2 fixtures; its primitive-only logical snapshot reader is not the binary SQL backup path.

The deletion audit records run ID, original hash, encoded bytes and time. It is excluded from reference roots so an audit record does not accidentally pin deleted payloads. Audit growth is included in the model. Dry-run reports are returned/logged; dry run writes no deletion audit or payload mutation, but deliberately advances the fence epoch for a consistent inventory.

## Format, capacity and physical storage

New payload chunks store BLOB bytes with an empty legacy `body`; old base64 rows remain readable. Hash identity always covers original uncompressed JSON. The existing gzip threshold and 4 MB decoded limit remain. Eight chunk rows fit one INSERT, with at most 24 bindings and 384 KB binary payload. No extra dependency or paid cache was introduced.

`repackLegacyPayload` verifies the full old object before bounded conversion. Mixed old/binary chunks remain readable after interruption. Re-running is idempotent, and the reverse `base64` target supports a verified reader rollback before reverting to old code. Reservations and content hashes do not change during repacking. Do not roll an old base64-only reader onto binary rows without reverse conversion and validation; stop GC and all writers before reverting to an unfenced deployment.

Physical measurements use the **actual application SQLite file**, read-only, through the system SQLite `dbstat`, `page_count`, `page_size` and `freelist_count`. Miniflare metadata files are excluded. `reports/sustainable-storage/storage-benchmark.json` contains per-table and per-index allocation, not inferred sizes. The schema and empty indexes alone occupy 2,060,288 bytes in this comprehensive POC fixture.

| Measurement | Base64 fixture | Binary fixture |
|---|---:|---:|
| Total allocated bytes before GC | 3,461,120 | 3,059,712 |
| Payload chunk table bytes | 1,372,160 | 1,003,520 |
| Encoded payload reservations | 990,916 | 990,916 |
| Reservations after expired cache/orphan sweep | 792,758 | 792,758 |
| Allocated bytes after GC | 3,461,120 | 3,059,712 |

Binary eliminates base64 CPU/string conversion for new data and reduces the chunk table's allocated pages by about 26.9% in this fixture. GC removes six payloads across bounded transactions; three are expired AI responses and three are explicit unreferenced objects. Those fixture proportions are not applied to annual traffic. No user-owned root was removed. A file converted in place need not shrink: free pages become reusable. **No VACUUM, remote rebuild or physical-shrink claim was used.** Six replacement payloads fit in the binary fixture's existing allocation after collection.

`storageCapacity` now reads the manifest sum and counter in **one consistent SELECT**, reports incomplete reservations, and fails closed on mismatches. It exposes D1's returned `meta.size_after` when available, separately from encoded reservations. Warning/critical status is triggered at 70%/90% of either the 64 MB payload reservation limit or the 500 MB database limit. Unknown physical size stays unknown. Quota exhaustion is a typed error; the Worker boundary returns a retryable 503 for storage quota/maintenance failures that reach it. Route-specific handlers can still map errors through their existing contracts; this is not an assertion that every route emits an identical response.

A sustainable payload budget depends on structured growth too. At the inherited 50-DAU day-365 structured footprint of **431,506,095 bytes**, a 500 MB database would leave only ~57.1 MB of encoded payload at the assumed 1.2 page factor; a 350 MB headroom target leaves **zero**. Thus simply lifting 64 MB would be wrong. The runtime limit remains unchanged, accurately releases only deleted reservations, and is not represented as a solution to the retained-growth problem.

## Free-tier costs, projections and runtime constraints

Verified official references: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 return metadata](https://developers.cloudflare.com/d1/worker-api/return-object/). Free limits are 500 MB per database, 5 GB/account, 5 million rows read/day and 100,000 rows written/day account-wide; 50 D1 queries per Worker invocation; Workers Free has 100,000 dynamic requests/day and 10 ms CPU/invocation. Additional databases do not add daily operation allowances. Account headroom was not rechecked, and no account resource allowance is assumed available merely because it is advertised.

Reproduce all 20 DAU/horizon combinations with `python3 scripts/project-sustainable-storage.py`. The source is the inherited no-billing affine model, retaining fixed ingestion at **zero DAU**. Improvements credited: remove base64 overhead and keep only the already-valid one-day AI response window, plus projected audit overhead. Preserve other histories and assume zero unknown orphan savings. A 20% page reserve, 160 bytes/audit row, scan density of 256 structured bytes/row and 200 expired inference results/day are **planning assumptions**. File-shrink credit is zero. Fresh binary database demand is projected; these are not measurements of a production database or guarantees that admissions can continue past the unchanged cap.

| DAU | Annual revised demand | Requests/day | Projected reads/day with daily cleanup | Known writes/day lower bound |
|---:|---:|---:|---:|---:|
| 0 | 4.303 GB | 8,034 | 3,827,666 | 75,140 |
| 10 | 4.312 GB | 8,611 | 3,853,195 | 75,426 |
| 25 | 4.324 GB | 9,475 | 3,891,488 | 75,854 |
| 50 | 4.346 GB | 10,916 | 3,955,309 | 76,567 |
| 100 | 4.388 GB | 13,798 | 4,082,955 | 77,993 |

| Horizon, 50 DAU | Revised projected demand |
|---:|---:|
| 30 days | 392.9 MB |
| 90 days | 1,100.8 MB |
| 180 days | 2,162.8 MB |
| 365 days | 4,345.6 MB |

Projected reduction is ~26% from the old annual envelope, **not sufficient**. Encoded admission still exhausts in ~7.18 days under the assumed arrivals. Even 30-day demand exceeds 30% storage headroom. Cleanup costs and fence writes erode operation headroom. The model includes a separate sensitivity for one fenced transaction per four inherited row writes, which can exceed 100,000 daily writes; real transaction rate is unknown. Do not read a lower-bound total as free-tier qualification.

The collector is intentionally **not a single Worker invocation**: a mark traverses all retained roots/objects, and exceeds 50 queries even in the small fixture. The local-only maintenance wrapper has no remote mode. A hosted, bounded, durable mark/sweep coordinator or an owner-side remote maintenance executor must be designed and qualified before using this on a remote deployment. Neither has been smuggled in as a paid service. Graph scans cannot be treated as free simply because deletions are bounded.

Maximum-size 4 MB payload validation measured **26 D1 statements** with the write fence (8 binding calls in the recorded targeted run), versus 19 at baseline. Actual API metadata from browser workflows also records **whole requests above 50 queries**, with a maximum of **875 statements** in this local fixture. Those workflows pass locally, but local workerd does not demonstrate Workers Free's per-invocation quota enforcement. This is an explicit additional launch blocker, not a claim that route-level query limits are satisfied. Hosted CPU is unmeasured; JSON/gzip/hashing/Argon2 costs cannot be substituted with local wall time. No zero-cost production DAU is certified.

## Running the safe local tools

Apply all additive migrations before using the new adapter. Current local configs remain PostgreSQL-free and R2-free. No remote maintenance command is provided by the collector wrapper.

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --local --config wrangler.api-no-billing-local.toml --persist-to /private/tmp/dd-storage-review
# Stop ALL local Workers, SDK clients, raw SQL and imports before maintenance.
DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED node --import tsx scripts/collect-sustainable-storage.mjs /private/tmp/dd-storage-review --dry-run
# Explicit maximum 500 candidate objects; each object transaction has four statements.
DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED node --import tsx scripts/collect-sustainable-storage.mjs /private/tmp/dd-storage-review --apply 500
# Optional, one verified object per owner invocation:
DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED node --import tsx scripts/collect-sustainable-storage.mjs /private/tmp/dd-storage-review --repack-binary ORIGINAL_SHA256
# Reverse conversion before a baseline-reader rollback:
DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED node --import tsx scripts/collect-sustainable-storage.mjs /private/tmp/dd-storage-review --repack-base64 ORIGINAL_SHA256
```

The wrapper selects the existing local test database UUID and does not create Cloudflare resources. It is not a general production database selection tool. Keep the owner-managed encrypted offline backup process from the no-billing report; the logical exporter now emits typed SQL BLOB literals via `hex()` to avoid CLI JSON ambiguity. Password reset probes read binary mail safely through SQL hex values too. Backup exports contain the full schema, binary payloads, FTS rows and original identities.

Crash recovery: ensure the old collector and every raw writer really stopped, preserve the existing database/offline backup, inspect `app_storage_epoch` and audit rows, verify required roots and counter sums, then explicitly advance the epoch and clear the lock on the unserved local target. Do not blindly unlock an active collector or use a timed lock expiry. Retrying a sweep is idempotent because only existing unreferenced manifests remain eligible; previously committed deletion audits and counters remain exact. Failed transactions and corrupt payloads are tested to fail closed.

## Validation and decision

Evidence resides under `reports/sustainable-storage/`; final validation totals are:

- Root suite: **1,072 passed, zero failed, two existing skips** across 242 test files. Skips cover a PostgreSQL-only rollback fixture and an HTTP-only harness; the latter also passes through actual workerd in browser validation.
- Full Worker/D1 suite: **126 passed, zero failed**. Existing authentication, Front Office, Parlay, editorial, historical retrieval and recovery-chain tests remain present.
- Dedicated storage/runtime subset: **six passed**, including stale publication fencing, nested references, saved evidence, pins, rollback on failed sweep, incomplete/corrupt data refusal, abandoned lock safety and forward/reverse chunk conversion. This overlaps the full suite and is not added again.
- Actual local workerd authentication: **ten scenarios passed**, preserving native Argon2 PHCs, reset single-use semantics, invalid credentials, session expiry/concurrency/logout and restart. Additional preferences checks passed; real email was not sent.
- Desktop/mobile Chrome: **48 routes and 12 HTTP/product checks passed**, including authenticated trade persistence, saved IDs, preferences, Trivia, ownership and restart. Not a hosted Free-plan qualification.
- Owner-maintenance CLI integration: **PASS** on a freshly created synthetic database; dry run, actual deletion, repeated idempotent run, original saved ID and nested root preservation were checked using the exact documented command wrapper. TypeScript module loading was validated explicitly.
- Full synthetic encrypted SQL restore: **PASS**, exact logical tables including accounts, PHCs, sessions, saved bet, preferences, Front Office state, FTS and binary chunks; zero FK errors and tamper rejection.
- **40 migrations** applied, second application had no pending migrations, zero FK errors. TypeScript and API-only split build PASS. Existing baseline web assets were reused; current web wrapper ran in workerd. No fresh complete frontend build or native device test is claimed.

The CLI was validated against the schema produced by actual local Wrangler migrations, not only hand-applied test migrations. Guard and pin tables use WITHOUT ROWID to avoid redundant primary-key indexes. The revised GC fixture reports 251 queries in its first mark/sweep, with 1519 rows read and 25 rows written; rerunning an empty sweep makes no object deletion. These exact local metrics are saved, not extrapolated as production CPU.

 Tests cover nested Front Office state, saved betting evidence, recovery pins, dry runs, stale publishers, active cache leases, corruption refusal, transaction rollback, abandoned maintenance locks, idempotent format conversion and reverse-format rollback. Existing authentication security, editorial IDs and Parlay calculations are retained.

The browser checks use Chrome desktop/mobile **viewports**, not Android/iOS devices. No shared UI or native rendering code changed. Actual local workerd auth and encrypted full restore validate binary persistence; provider calls remain blocked. Existing R2 fixtures remain in the regression suite solely to preserve rollback coverage, while no-R2 runtime/configurations and dedicated tests prove the new path.

**Remaining blockers:** retained editorial/odds/identity-score growth; no approved reference-safe deletion contract for the dominant historical aggregates; unchanged admission exhaustion; route-level D1 query amplification; owner-local rather than remotely coordinated GC; hosted CPU/actual operation rates; real account/service allowances; production-scale recovery RTO and reliable daily owner backups. Storage operation limits must be resolved together, not traded for unsupported deletion.

**Recommended next action:** review the measured table/object inventory and define which historical *derived* odds/identity/score generations can be removed while retaining saved-bet evidence and read-by-ID behavior. Then implement that explicit lifecycle with dedicated preservation tests, and batch/restructure high-query aggregate persistence. Do not deploy this as a sustainable 50-DAU launch, increase the cap to postpone failure, enable billing, or delete published/user history to make the projection pass.
