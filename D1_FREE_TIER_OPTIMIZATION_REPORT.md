# D1 Free-tier optimization results

2026-10-19. Baseline `bbbfc526` (`poc/sustainable-d1-storage`). Isolated worktree `/private/tmp/down-distance-staging-preparation`, branch `poc/d1-free-tier-optimization`.

**Decision: NO-GO for a sustainable 25–50 DAU launch.** The measured critical HTTP sample now stays below 50 statements, but annual retained storage still exceeds one Free D1 database. This is a validated local improvement, not a claim that every possible invocation or 365-day operation is qualified. No deployment, remote resources, billing activation, production access, or existing user-data deletion occurred.

## Results

| Metric | Before | After |
|---|---:|---:|
| Maximum complete sampled API request | 875 statements | **48 statements** |
| Sampled requests at or above 50 | baseline recorded 12 above 50 | **0 / 1,178 samples** |
| 200 small immutable objects: incremental SQLite allocation | 61,440 bytes, legacy base64 chunks | **45,056 bytes, inline binary** |
| Same 30-object binary fixture: total SQLite file | 3,059,712 bytes, baseline schema | **3,067,904 bytes**, new schema |
| Fixture encoded reservation before / after safe GC | 990,916 bytes | **792,758 bytes** |
| Fixture file size before / after GC | 3,067,904 bytes | **3,067,904 bytes** |
| 50 DAU / 365 days retained-demand planning envelope | 4,345,587,537 bytes | **4,345,587,537 bytes**, no speculative annual saving credited |
| Payload admission limit | 64,000,000 bytes | **unchanged** |
| Approximate admission exhaustion, inherited 50-DAU workload | 7.18 days | **7.18 days**, conservative envelope |

The small-object incremental reduction is 26.7%; it is not a 26.7% reduction in the whole database. New internal maintenance tables cost pages. The large high-entropy fixture does not shrink from inline storage; SQLite overflow pages still dominate. GC frees 48 pages for reuse and six verified unreferenced/expired objects, not physical file bytes. Replacement uploads reused existing pages. No VACUUM or physical-shrink credit is assumed. These are synthetic local measurements, not production proportions.

Evidence: `reports/d1-free-optimization/{queries,storage-benchmark,capacity,migration-repeatability,offline-restore,password-runtime,owner-maintenance-cli}.json`; browser evidence is in the adjacent `browser` directory.

## Root cause and query changes

D1 was paying for the R2-oriented immutable graph representation. An aggregate split into many tiny literal nodes; each upload performed multiple guarded transactions, chunk/manifests reads, and verification reads. Nested loads repeated those costs. `db.batch()` reduced network calls but did not erase SQL statements from the invocation budget.

Implemented:

- D1-specific compact JSON-tree literals, up to the existing 4 MB decoded object bound. Original IDs and relationships remain unchanged. Legacy object/array/string tree readers and R2 writers remain supported.
- Atomic object admission, chunk insertion, completion and reservation accounting. Eight binary chunks per INSERT, at most 24 parameters. A 4 MB incompressible object measures **22 statements**, including the request fence and verification.
- Inline compressed binary objects at or below 48 KB, avoiding a separate chunk row and chunk-index metadata. Larger objects retain binary chunks; old base64 chunks remain readable and repackable.
- One joined manifest/chunk retrieval, bounded request-local verified-byte cache, and inline batch prefetch. Prefetch holds at most 2 MB encoded bytes; decoding and SHA-256 checking remain lazy. Verified decoded cache holds at most 8 MB. Returned buffers are copied. A 100-object retrieval test stays within five statements and rejects corruption.
- Checkout reuses its request-local cart for quote and persistence and combines catalog initialization writes. Stock, promo eligibility, price and version guards still revalidate atomically. No global or cross-user cart cache.
- Logs now include method and matched route pattern, without path IDs. The old worst sample was labeled only `other`; attributing that exact 875-statement sample to a specific endpoint would overstate the old telemetry.

Measured maximum paths in the final local browser/HTTP run:

| Path | Statements |
|---|---:|
| POST `/api/commerce/checkout` | 48 |
| POST `/api/crew/invites` | 45 |
| POST `/api/saves/create` | 43 |
| POST trivia game answer | 38 |

These are complete API Worker invocations, including authentication and guards, not isolated adapter timings. No user action was split into extra requests to disguise SQL work. Checkout and Crew still have limited headroom. Legacy large graph reads, large chunked editorial lists, accumulated odds-history reads, cold catalog seeding, and background jobs with large inputs are **not universally certified below 50**. This remains an explicit blocker; the sampled maximum is not a universal bound.

## Historical retention and durability

| Category | Explicit contract |
|---|---|
| Accounts, sessions, preferences, Front Office, saved evidence | Retained; no age deletion. Original IDs preserved. |
| Published editorial versions, attribution, historical odds | Retained. Existing read-by-ID and historical price APIs still promise these records. |
| Superseded Lab Scores | Remove at most 20 directory rows whose board/reference version no longer matches the source. The existing read interface already rejects these rows. Payload deletion requires reference-aware GC. |
| Old computed immutable objects | Collect only if no SQL root, transitive JSON reference, recovery dependency, or explicit pin reaches them. |
| AI responses | Existing expired-cache/lease contract only; no active response or lease is removed. |
| Consumed, long-expired capabilities | Archive original complete rows in a verified immutable pack, then atomically delete exact token tuples with a row-count guard. Active/unconsumed tokens remain. |
| Ingestion and unknown historical payloads | No new age-based deletion. No unproven reconstructability assumption. |

Source-version score expiry is integrated into `maintainTemporaryData`, with a bounded owner CLI option as well. Token archival now uses one exact-tuple bulk delete instead of 15 separate guarded deletes; the 15-token D1 invocation is tested below 30 statements. Deletion and archive-directory publication roll back together on conflict.

Current score heads and market identity directories already overwrite old generations. That does **not** establish that every historical payload is garbage: odds-history rows, saved references, and other directory roots remain. The inherited capacity model combines identity, score and public payloads in one bucket; it cannot support a precise annual stale-score credit. Compact whole-document persistence can also trade cross-revision deduplication for fewer queries. No unmeasured annual storage benefit is claimed.

Tests preserve an old market ID and two price generations after score invalidation and GC, and preserve the saved/pinned old score payload. Corruption, missing roots, unsupported encrypted recovery data and unknown logical root schemas fail closed. Existing hashes are not rewritten. Incomplete compatible legacy uploads resume; mismatched encodings require owner repair rather than replacement.

## Bounded maintenance

Additive migrations **0041** and **0042** add inline payload support and durable GC plan/candidate tables. PostgreSQL rollback history is untouched.

Owner preparation still performs the full verified reference scan with all raw writers stopped. It publishes at most 500 candidates under a persistent epoch fence. Each subsequent private step deletes one planned object, releases its reservation, appends its audit record, and advances the cursor in one transaction. Normal library steps use at most 10 statements; conflict recovery adds one. The tested private Worker stays within 12. Completion unlocks the epoch; repeated completed steps are idempotent.

There is **no public maintenance route**. The test-only private Worker requires its synthetic bearer credential; that test is not a deployed security boundary. The production application does not expose the executor. The owner CLI is local-only and requires explicit acknowledgement. It takes an isolated persistence directory, not a remote database name.

```sh
# Stop application writers and owner SQL tools first. Use the actual isolated
# local persistence directory. Never clear the epoch lock manually after a crash.
export TSX_TSCONFIG_PATH=tsconfig.test.json
export DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --expire-scores 20
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --dry-run 5
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --prepare 5
# Copy result.runId from the prepare output. Repeat step until result.done=true.
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --step RUN_ID
```

**Limitation:** marking is owner-local, unbounded in database size, and pauses SDK writes until completion. After a crash, resume the durable plan; do not force-unlock it. Concurrent SDK writers fail/retry across epochs. Raw SQL bypasses the SDK and must remain stopped. This is a bounded sweep with safe continuation, **not** a completed online incremental collector. The CLI integration and actual local workerd concurrency/restart tests pass.

## Capacity and costs

Verified official limits: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) specify 500 MB per Free database and 50 queries per invocation; [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) specifies account-wide daily allowances of 5 million rows read and 100,000 rows written. Index maintenance adds writes. The 5 GB account storage allowance does not make one 5 GB Free database. No live account headroom was inspected in this mission.

Projected demand in decimal MB, retaining the inherited background ingestion even at zero DAU:

| DAU | 30 days | 90 days | 180 days | 365 days |
|---:|---:|---:|---:|---:|
| 0 | 382.9 | 1,085.1 | 2,138.4 | 4,303.4 |
| 10 | 384.9 | 1,088.3 | 2,143.2 | 4,311.8 |
| 25 | 387.9 | 1,093.0 | 2,150.6 | 4,324.5 |
| 50 | 392.9 | 1,100.8 | 2,162.8 | 4,345.6 |
| 100 | 402.9 | 1,116.6 | 2,187.2 | 4,387.8 |

These are counterfactual retained-demand projections beyond the enforced 64 MB admission stop, not a prediction that the application continues writing after exhaustion. All 20 scenarios, structured/search/index allocation, AI bound, GC audit allocation, background requests and daily read/write sensitivities are in `capacity.json`. Reproduce with `python3 scripts/project-d1-free-optimization.py`.

At 50 DAU / 365 days, the inherited envelope contains approximately 431.5 MB structured tables/indexes, 3,252.0 MB retained encoded payloads, a 20% payload/page reserve and 11.68 MB assumed audit growth. Compact/inline fixture savings are not extrapolated to that unknown mixture.

At that workload: 10,916 Worker requests/day; projected **3,955,309 D1 rows read/day**, including the assumed daily full mark; known lower-bound **74,744 rows written/day** after four fewer fence writes per object. A transaction/index amplification sensitivity reaches **111,158 writes/day**, above the Free limit. These remain inherited assumptions, not measured traffic or a safe write budget. The daily mark projection is roughly 94,575 statements owner-side; bounded sweeping does not eliminate marking costs. Plan/candidate writes add workload-dependent overhead and no annual savings credit offsets that overhead. Keeping the prior audit allowance is a planning assumption, not proof of exact post-change usage.

The payload admission limit is the first modeled storage stop (~7.18 days at 50 DAU); even removing it would not solve annual storage. Large fixture physical allocation and multi-revision churn still need representative workload measurements. Hosted Worker CPU is **unmeasured**; local wall time and workerd success do not prove the Free CPU allowance is met. No new paid services, R2 operations, or external ingestion schedule changes were introduced.

## Validation

- Root automated suite: **1,072 passed, zero failed; two pre-existing skips**.
- Final complete Worker suite: **130 passed, 0 failed**. Combined automated total: **1202 passed, 0 failed**, two pre-existing skips. Logs: `reports/d1-free-optimization/regression/d1-all-tests.log` and `unit-tests.log`.
- Targeted payload/GC/runtime tests pass, including 4 MB high-entropy payloads, corruption rejection, concurrent sweep steps, restart continuation, pins, historical IDs, exact token archival, and legacy formats.
- **48 browser route/theme/viewport checks passed**, plus the browser runner's HTTP workflow checks and authenticated trade integration. Chrome desktop and mobile viewports; no Android/iOS device validation. No UI was changed.
- **42 migrations** applied, second apply had no pending migrations, zero foreign-key violations.
- Actual local workerd password scenarios pass, including native Argon2 PHC compatibility, invalid credentials, concurrent sessions, logout, expiration and reset. DATABASE_URL absent.
- Encrypted synthetic full SQL restore passes with no PostgreSQL or R2 binding: all exported tables exact, zero foreign-key errors, ciphertext tampering rejected. Accounts, authentication metadata, progress, saved evidence, preferences, FTS history and payloads preserved. Daily owner backup RPO remains 24 hours; hosted RTO unmeasured.
- TypeScript completion check passes. Original tests were preserved; corruption fixtures were adapted to inline storage rather than removed.

## Remaining blockers and next action

1. **Annual storage target not met.** Product-approved retention contracts for the large historical/public payload categories, or a separately approved durable archival architecture, are needed. Silently expiring published content, saved evidence or historical odds is not an acceptable fix.
2. **Universal invocation bound not established.** Qualify cold paths and large historical/legacy inputs; introduce product-compatible bounded pagination where interfaces currently allow unbounded history. Checkout/Crew need more headroom.
3. **Online marking remains incomplete.** A fully incremental, reference-safe marking protocol requires persistent root/edge tracking and further concurrency work. Current owner-window scanning is safe but unsuitable as a large live Worker invocation.
4. **Daily operations and hosted CPU unqualified.** Write sensitivity can exceed the account allowance. Hosted CPU and actual ingestion distributions require an approved isolated staging measurement, not production access.

Recommended next action: review these changes and the NO-GO result. Keep the 64 MB admission guard and existing rollback paths. Agree on the historical retention contract and representative content/ingestion fixture before further capacity claims. **Do not deploy this as a sustainable Free-tier launch.**
