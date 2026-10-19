# Approved retention implementation

2026-10-19. Baseline `6a4bdecd`; dedicated branch `poc/approved-retention-implementation` in isolated worktree `/private/tmp/down-distance-staging-preparation`.

**Ready for staging: NO. Ready for production: NO.** The approved policies are implemented through an archive-gated, owner-local retirement workflow and bounded private cleanup steps. The existing workload model still exceeds 350 MB. Final regressions: **1,072 root + 136 Worker = 1,208 automated passes, zero failures**, plus **48 browser checks**. Production cleanup, ingestion and deployment were not enabled. No production data, remote resources, paid services, PostgreSQL or remote R2 were accessed.

## Result summary

| Deliverable | Result |
|---|---|
| Retention policy implementation | PASS for supported, provably eligible clusters; missing timestamps, unknown roots, required references and oversized clusters fail closed or remain retained |
| Editorial storage before / after | Matched annual scenario: public + canonical records **2,695.6 → 717.5 MB**, excluding source evidence and physical reserve |
| Required source evidence before / after | **575.8 → 153.3 MB** in the saved-reference scenario; evidence for retained articles cannot use the seven-day unreferenced-candidate window |
| Odds history before / after at 50 DAU | **196.7 → 196.7 MB** in the conservative saved-event scenario; at zero DAU, unsaved general history is bounded to 30 days |
| Total D1 projected storage, 50 DAU / 365 days | Matched **4,855.4 → 1,840.2 MB**, including physical reserve and new audit/receipt costs |
| Reference sensitivity | If retained notifications/observers/other roots require all aged records: **4,920.6 MB**; unknown extra product volumes remain unqualified |
| Maximum complete sampled HTTP invocation | **48 → 38 statements** |
| Cleanup step budget | Library maximum **28 statements including conflict recovery**, owner CLI adds one lookup; below 30. Tested private Worker maximum is in `boundaries-runtime.json` |
| Garbage collection | Existing verified graph collector reused after logical retirement; durable sweep steps preserved. Full marking remains owner-local and unbounded |
| Offline archival | AES-256-GCM, SHA-256 file identity, full disposable SQL restore and exact application-table/FTS-row-ID comparison **before** publishing a deletion plan |
| Recovery validation | PASS: archive tampering blocks cleanup; saved articles/corrections, bets, accounts, progress, preferences, trivia and rewards survive |
| Tests | **1208 automated passed, 0 failed**, two pre-existing root skips; **48 browser checks passed** |

MB means decimal megabytes. Storage is a synthetic planning scenario, not measured production occupancy. The 64 MB payload admission guard remains enforced; demand projections beyond it are counterfactual, not evidence that writes can continue until these projected totals.

## Policy and eligibility

The policy is recorded in `RETENTION_DAYS` and `retention-contracts.ts`.

| Dataset | Implemented contract |
|---|---|
| Published NFL articles | Eligible after 90 days, measured conservatively from the latest meaningful/header/version update. Younger records remain. |
| Saved or otherwise required articles | Retain while referenced, including all linked published corrections, versions, original IDs and attribution. References are checked in SQL and reachable immutable JSON, not only `app_saved_content.content_id`. |
| Unpublished drafts | Seven days after the last eligibility/state update. Previously published records use the 90-day policy, even if currently hidden or draft. Missing/unknown eligibility timestamps are not guessed. |
| Source candidates | Seven days after proven completed processing. NEW/FAILED/uncompleted jobs and missing processing timestamps do not qualify. Evidence required by any retained article or recovery reference remains. |
| Candidate identity | Keep a compact receipt containing original ID, source/external identity, canonical URL and fingerprint. Re-ingestion checks receipts, preventing archived candidates from being recreated under fresh IDs. |
| Three & Out | Thirty days, unless saved/referenced or required by pending mail/delivery work. Required push/inbox references can conservatively prevent expiry. |
| General odds history | Thirty days. Current active-event heads remain. Old inactive-event board payloads can be detached; event/player/market/book identities remain unchanged. |
| Saved bet/slip evidence | Permanent. Saved event or market references preserve associated historical boards conservatively; no incomplete evidence extraction is substituted. |
| Lab Scores | Existing source-version invalidation remains. Retiring an old inactive board can remove its unreferenced cache directories. References to score payloads prevent retirement; saved evidence is never dropped. |
| AI | Existing 24-hour TTL with lease protection and audited derived-directory cleanup. |
| Accounts, preferences, Front Office, trivia/rewards | Permanent, including progress, earned points, required revisions, ownership and command/idempotency receipts. Authorized account deletion remains a separate existing workflow. |

A general article cluster includes public/canonical headers, all versions and decisions, wire events, overrides, evidence links and its FTS projection. Retirement removes these related rows atomically. Candidate payload removal is a separate eligibility decision: deleting an article does not automatically authorize deleting a shared source candidate. Completed candidate-job payloads can be cleared after archival while keeping the original job and idempotency key.

Expired unsaved articles leave both live feeds and search after a retirement step. Saved/currently required IDs remain resolvable. Expired, unreferenced IDs are intentionally no longer online under the approved policy; their original IDs and relationships remain available in the verified offline archive. No IDs are reassigned and no saved links are silently redirected.

## Reference verification and concurrency

Preparation snapshots all application tables under the existing monotonic writer-epoch fence, with raw writers stopped. It verifies the reviewed root schema, every complete immutable object's SHA-256, chunk ordering/length and nested references. Unknown encrypted recovery inventories, unresolved roots and corruption fail closed. The existing known encrypted-mail contract is retained.

Eligibility is calculated as a fixed point. Removing a candidate cluster from consideration restores its SQL roots and reachable payloads; those references can protect more clusters. References from retained or omitted clusters, nested saved metadata, published version IDs, recovery pins and shared immutable objects are considered. The bounded prefix is checked again with all omitted clusters retained. This avoids deleting a referenced candidate merely because its referring article is outside the current batch.

Protection deliberately over-retains when identity or reference meaning is ambiguous. For example, a saved market ID without a reliable evidence timestamp preserves the event's older boards; the system does not guess which historical price the user needs. Existing notifications, observer histories and unknown application references can keep otherwise aged articles online. These costs appear in the sensitivity model.

SDK writers cannot publish across the maintenance epoch. A crash leaves the fence held; stale writes fail/retry. Raw SQL/import/ingestion writers bypass SDK fencing and **must remain stopped**. This is an owner maintenance window, not an online concurrent marking service.

## Archive-first execution

New additive migration **0044** creates only internal plan/item/audit/identity-receipt tables. Existing logical root-table definitions and rollback migrations are preserved.

The supported owner CLI performs the following sequence:

1. Acquire the writer fence and read the frozen application snapshot.
2. Export all application data, including binary payloads and FTS row IDs.
3. Encrypt with a separate owner-supplied 32-byte key and create the archive with restrictive permissions and no overwrite.
4. Read the stored file back, authenticate/decrypt it, and compare its plaintext bytes.
5. Restore the SQL into a disposable local D1 database, compare every application table and FTS row ID, and verify foreign keys.
6. Recheck that the source snapshot has not changed, then publish a bounded plan.
7. Each later CLI step checks the archive's SHA-256 and availability before calling the private executor. Missing/tampered archives block deletion.

The encrypted archive is a complete frozen application backup, not an unverified partial pack or incremental chain. Its original IDs/relationships are tested. Full restore verification also exposed and fixed an existing exporter gap: FTS row IDs were previously regenerated on import, which could disconnect `app_public_stories.search_rowid` from search rows. The exporter now preserves those IDs explicitly.

Archival is optional operationally: an owner may decline to archive and keep the online data. **There is no archive-free destructive `--force` path.** The internal planner/executor is a trusted owner library, not a public security boundary; its supported deletion entry point is the archive-verifying CLI. The test-only private Worker is not deployed or bound into the production app.

```sh
# Local owner workflow only. Stop app/ingestion/import/raw writers first.
export TSX_TSCONFIG_PATH=tsconfig.test.json
export DD_APPROVED_RETENTION=OWNER_LOCAL_WRITERS_STOPPED
# Use a separate protected 32-byte archive key, not an authentication secret.
# Example key creation: umask 077; openssl rand -out OWNER_KEY_FILE 32
node --import tsx scripts/approved-retention.mjs --prepare LOCAL_PERSIST_DIR OWNER_ARCHIVE.enc OWNER_KEY_FILE 500
node --import tsx scripts/approved-retention.mjs --status LOCAL_PERSIST_DIR
node --import tsx scripts/approved-retention.mjs --step LOCAL_PERSIST_DIR RUN_ID
# Repeat --step until done=true; retain the archive and key for recovery.
```

Only plan preparation/verification performs the full scan/export/restore. It is unbounded owner-side work and can pause writes for a long time. A large source database needs local disk, CPU and a maintenance window. It must not be moved into a Free Worker invocation unchanged.

If a crash occurs during PREPARING, no executor step is allowed. The owner can inspect status and abort that **not-started** plan with `--abort-preparation LOCAL_PERSIST_DIR RUN_ID`, then prepare again. If RUNNING, resume its durable cursor; never force-unlock or abort a partly executed plan. Fence acquisition and a PREPARING intent are now atomic, so a process crash cannot leave an anonymous fence. Even an interrupted export has a durable intent that can be safely aborted before any application-row deletion. Archive files are never automatically deleted by the tool.

## Bounded deletion and payload GC

Each private step loads one plan and one item, checks the epoch and continuation cursor in an atomic guard, applies at most 20 related SQL operations, records original IDs/archive digest, advances the cursor and removes the consumed item's verbose operations. This prevents maintenance plan JSON from accumulating indefinitely. Compact audit/identity records remain and are charged in projections.

The maximum is 27 statements for a normal nonempty step and 28 including conflict recovery; the owner CLI adds one plan lookup. Empty/completed plans use fewer. Oversized clusters (>20 operations or >500 rows) are excluded and reported instead of executing an unlimited batch. Crash/restart, repeated completion, two concurrent steppers, unauthorized access to the test-only service and injected audit failure are tested. Failure rolls back row deletion and cursor/audit publication together.

Root retirement does **not** delete payload bytes or release the payload counter. After the plan completes and unlocks, use the existing owner collector to verify the surviving graph again and publish/sweep only unreferenced payload candidates:

```sh
export DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --expire-derived 20
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --dry-run 500
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --prepare 500
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --step GC_RUN_ID
```

Repeat the bounded steps, not the full mark per object. Existing GC keeps recovery pins, nested references, saved evidence and exact reservation/audit accounting. In the mixed synthetic boundary fixture, encoded payload allocation fell from **13,465 to 7,947 bytes** after retirement and verified GC; this is not a whole-database or production saving. A logical deletion creates reusable SQLite pages; it does not prove that the physical database file shrinks. No VACUUM or physical-shrink saving is claimed.

## HTTP query optimization

Single-recipient social notifications now use one immutable document for both outbox and inbox. A guarded atomic transaction publishes the inbox row and advances the delivery cursor without a second object upload or claim transaction. Owner identity, dedupe key, expiry and notification IDs are retained. Concurrent delivery produces one inbox item; other owners cannot export it. Legacy and multi-recipient formats still work.

Final sampled complete local HTTP paths:

| Workflow | Baseline | After |
|---|---:|---:|
| Checkout | 48 | **38** |
| Crew invitation | 41 | **31** |
| Front Office save creation | 36 | **36** |
| Trivia answer | 36 | **36** |

The final browser/HTTP sample contains 1,180 instrumented responses, four at/above 30 and none at/above 50. No user action was split into artificial extra requests. Less than 30 is still not achieved for every critical route. Legacy/multi-recipient delivery backlogs, large Front Office aggregates, cold paths and large response CPU/memory remain unqualified as universal invocation bounds. Cleanup steps have their own hard statement bound; these sampled HTTP maxima are not universal guarantees.

Existing populated editorial/odds retrieval tests remain enabled, including 160 editorial versions, 200 odds generations, 64,000 prices, chunked integrity checks and 4 MB high-entropy objects. No UI was changed. Chrome desktop/mobile viewport tests are not Android/iOS device validation.

## Capacity model

The model keeps the previous independent synthetic content sizes and workload assumptions, then applies the approved windows and explicit saved/reference exceptions. It does not replace measured assumptions with smaller content to manufacture compliance. At 50 DAU / 365 days:

| Driver, before physical reserve | Retained scenario |
|---|---:|
| Public editorial versions/bodies | 132.6 MB |
| Canonical editorial versions/corrections | **584.9 MB** |
| Source evidence for retained articles | **153.3 MB** |
| General + saved-event odds history | **196.7 MB** |
| Lab Score/event cache upper allowance | 144.0 MB |
| Operational history | 116.9 MB |
| Accounts/authentication, Front Office, saved evidence | 50.4 MB |
| Search indexes | 28.7 MB |
| Candidate identity receipts | 26.9 MB |
| Existing GC + new retirement audit allowances | 67.2 MB |

Required canonical versions **alone** exceed 350 MB in this workload. Seven-day candidate expiry cannot erase evidence that is required by retained articles. Saved event references conservatively keep whole boards, so the 30-day general window does not guarantee a 30-day bound for saved history.

Planning case below assumes only the explicitly modeled saved references prevent expiration. Additional notification, observer, recovery and cross-content references can raise demand substantially. All-reference sensitivity is included in `capacity.json`; extra media/product/draft-creation volumes remain unknown rather than certified as zero.

| DAU | 30 days | 90 days | 180 days | 365 days | 730 days |
|---:|---:|---:|---:|---:|---:|
| 0 | 403.4 | 1,126.9 | 1,191.1 | 1,323.1 | 1,583.5 |
| 10 | 404.5 | 1,188.8 | 1,349.4 | 1,679.7 | 2,331.2 |
| 25 | 406.2 | 1,201.8 | 1,387.5 | 1,769.2 | 2,522.2 |
| 50 | 408.9 | 1,209.5 | 1,415.9 | **1,840.2** | **2,677.3** |
| 100 | 414.3 | 1,224.8 | 1,472.8 | 1,982.3 | 2,987.6 |

These are MB per single database, with a 20% allocation reserve. Fixed ingestion remains at zero DAU: 96 published articles/day, four versions/article, two evidence candidates/article, 32 briefings/day, 16 events refreshed three times/week, 2,000 markets/event. Canonical size is an explicit proxy based on measured synthetic legacy public bodies, not a measured production canonical compression ratio. Saved article/briefing accumulation, user growth, permanent progress and audit/identity growth remain in the model.

The matched annual reduction is **4,855.4 → 1,840.2 MB** under the saved-reference scenario. With all aged content externally referenced, the scenario is **4,920.6 MB**. This is not proof of the amount a real account will retain. Reproduce all 25 combinations with `python3 scripts/project-approved-retention.py`.

D1 Free limits remain [500 MB per database and 50 queries per invocation](https://developers.cloudflare.com/d1/platform/limits/); [daily rows-read/write allowances](https://developers.cloudflare.com/d1/platform/pricing/) are account-wide, not multiplied by creating databases. No sharding or capacity increase was introduced. The 64 MB payload admission stop remains; the model does not mean the application can reach its 90-day steady window before admission fails.

At 50 DAU, the inherited operations envelope plus assumed retention writes gives approximately 3,955,709 reads/day and 89,548 writes/day; amplification sensitivity reaches 125,962 writes/day. Owner snapshot/export/full-restore verification adds database-size-dependent reads not fully quantified here. These are planning assumptions, not hosted billing measurements. Local D1 metadata may not capture the same indexed-write accounting. Hosted CPU is unmeasured.

Offline disk matters too. Retaining two copies of every daily full verified archive gives about **950 GB** in the annual demand scenario, before SQL/base64/export variability. More than one preparation/day requires more archives. No unimplemented incremental deduplication or archive rotation saving is assumed. These are counterfactual demand footprints beyond the unchanged admission stop; the actual tested archive is small and synthetic. Owner-managed storage/key durability and scheduled execution are operational requirements, not free cloud resources magically supplied by this change.

## Validation and recovery

- Retention boundaries: 6, 7, 29, 30, 89, 90 and 91 days.
- Saved articles/corrections, source references, recovery pins and saved-market evidence survive both retirement and payload GC.
- Omitted-prefix references and formerly published drafts prevent unsafe early deletion.
- Original IDs, source attribution, search removal and foreign-key consistency are verified. The owner integration also simulates interrupted preparation, restarts the executor, aborts only the PREPARING intent and successfully prepares again without losing application data.
- Private actual-workerd cleanup steps test concurrency, restart, authorization and atomic audit-failure rollback.
- Real owner CLI verifies AES-GCM integrity, complete SQL restore and matching FTS row IDs before any deletion. Tampering prevents cleanup. Permanent user data, preferences, points/rewards and Front Office progress are seeded and preserved.
- Actual local Worker authentication and full encrypted no-PostgreSQL/no-R2 recovery probe passes.
- 44 migrations apply; repeat apply has no pending migrations and zero foreign-key errors.
- Full automated and browser results are recorded in `reports/approved-retention/validation-summary.json` with raw logs in `regression/`. No tests were removed. Full regressions retain local emulated-R2 rollback tests; dedicated application checks omit R2 bindings.
- A targeted notification test initially lacked its required synthetic auth secret; rerunning with the standard test environment passed. Security validation was not relaxed.

## Remaining blockers and next action

1. **Storage target not met.** Canonical version/correction payloads within the approved 90-day window remain the largest driver. Lossless canonical version/body sharing, stronger measured compression and representative real-size fixtures are needed. Do not shorten the approved window or drop published corrections silently.
2. **Referenced source/odds history remains expensive.** A separately verified, complete saved-bet evidence representation could avoid retaining whole event boards, but incomplete metadata cannot justify deletion. Evidence needed by retained articles must remain. Notifications/observer references may prevent expiry and need an explicit ownership/read contract before treating them as non-owning.
3. **Operational/identity/audit growth remains unbounded.** Compact idempotency receipts preserve IDs and prevent re-ingestion; arbitrary age deletion would change behavior. Reviewed rollups or identity compaction are needed for multi-year operation.
4. **Admission and query headroom remain blockers.** Keep the 64 MB guard. The current fixed workload can exhaust it before 90-day article cleanup becomes useful. Checkout remains 38 statements; several flows remain above 30. No universal bound is claimed for legacy delivery backlogs or large user aggregates.
5. **Production automation is deliberately disabled.** Owner preparation is a full scan/archive/restore maintenance window. It is not a bounded hosted Worker job. Offline archive/key storage, availability, automation and restore RTO must be operationally validated before enabling cleanup anywhere live.

Recommended next action: review this local implementation and the NO-GO result. Validate representative canonical/source sizes, then prioritize lossless canonical payload compaction and complete saved-bet evidence extraction. The approved retention policy is necessary but insufficient for the stated content workload; **do not deploy or enable production cleanup/billing**.
