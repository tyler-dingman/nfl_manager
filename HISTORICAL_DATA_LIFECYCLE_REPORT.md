# Historical data lifecycle results

2026-10-19. Baseline `94165926`; isolated worktree `/private/tmp/down-distance-staging-preparation`, branch `poc/historical-data-lifecycle`.

**NO-GO: the 50 DAU / 365-day / 350 MB objective is not achieved.** This change preserves required history, implements bounded audited cache expiry and shared public editorial bodies, and improves historical reads. It does not establish a sustainable Free-tier launch. No production systems, remote resources, paid services, remote R2 or PostgreSQL were introduced or accessed. Nothing deployed. Existing editorial/user records were not deleted or rewritten; destructive tests used disposable synthetic data.

## Before and after

| Measurement | Before | After |
|---|---:|---:|
| Public editorial fixture: 40 articles × 4 published versions, encoded payload bytes | 2,006,690 | **568,758** |
| Public editorial fixture immutable object count | 160 | 200 |
| Historical odds retrieval: 200 single-market generations | per-generation envelope/tree queries | **20 statements**, exact 200 records |
| Public editorial list: 40 articles, all version bodies retained | per-object reads | **6 statements** |
| Complete HTTP Front Office save creation | 43 statements | **36 statements** |
| Complete HTTP Crew invitation | 45 statements | **41 statements** |
| Maximum complete sampled HTTP invocation | 48 statements | **48 statements**, checkout |
| Audited derived cleanup step | separate unaudited expiry operations | **7 statements**, ≤20 rows per policy |
| Annual 50-DAU inherited forecast | 4.35 GB | not reclassified as measured savings |
| New matched domain scenario, before / after public-body sharing | **6.37 GB** | **4.86 GB** |

The editorial fixture saves **71.7% of encoded public-projection bytes**, with unchanged 12 KB high-entropy bodies across four corrections. It adds small manifest objects. This is not a 71.7% whole-database or arbitrary-article saving. Small public bodies at or below 4 KB keep the original representation. New sharing applies to future writes; existing immutable payloads remain readable. There is no claimed physical SQLite file shrink.

The new annual scenario includes categories separately and an explicit canonical editorial proxy missing from an initial public-only calculation. Its matched before/after pair holds all workload assumptions constant. **Comparing the old 4.35 GB forecast directly with the new 4.86 GB scenario is invalid:** content entropy, versions, source volumes and category allocation differ. Neither is observed annual production storage. Both fail the objective.

Evidence and reproduction are under `reports/historical-lifecycle` and `scripts/project-historical-lifecycle.py`.

## Storage drivers and contracts

`packages/storage/retention-contracts.ts` records the classification and deletion conditions. Annual values below are encoded/structured planning bytes before the common 20% physical reserve, at 50 DAU / 365 days. They are independent assumptions and synthetic measurements, not production proportions.

| Dataset | Annual scenario MB | Contract and implementation |
|---|---:|---|
| Public editorial projections | 498.2 | REFERENCED HISTORY. All published versions, bodies, corrections, original article IDs and attribution retained. Shared immutable body for unchanged prose/source fields; compact version metadata remains separate. |
| Canonical editorial story/version/synthesis records | 2,197.3 | REFERENCED HISTORY. Retained. Four full versions plus one current head per article are charged using the measured legacy public-body size as a proxy. This is explicitly an estimate, not a measured canonical compression ratio. Claims/synth size beyond it remains uncertain. |
| Source ingestion candidates/evidence | 575.8 | REFERENCED HISTORY. Preserve source registry, candidates, URLs, evidence links, fingerprints and IDs. 192 candidates/day at the independently measured 8,216 encoded bytes/candidate. No arbitrary age purge. |
| Three & Out history | 37.9 | REFERENCED HISTORY. Preserve date-addressable briefings; 32/day at 3,248 encoded bytes. |
| Historical odds | 196.7 | REFERENCED HISTORY. Retain every timestamp needed by `priceHistory`, including original market/player/book IDs and prices. Three refreshes/week retained. |
| Market identities | 5.8 | REFERENCED HISTORY. Current cumulative identity directory per distinct event, rather than pretending each refresh creates another permanently required identity set. Never reuse IDs. |
| Lab Scores / Trending Props | 144.0 | RECONSTRUCTABLE only after existing board/reference version invalidation. Charge one score head per distinct event in the model; do not assume old events disappear simply because kickoff passed. Saved/pinned score payloads remain rooted. |
| Accounts / ownership / authentication | 17.2 | PERMANENT. Includes cumulative-user growth and session history assumptions. No pruning of accounts, ownership, sessions or preferences. |
| Front Office history | 23.1 | PERMANENT. Preserve revisions, command receipts, CAS/version checks, owner identity and recovery references. Direct D1 aggregate envelope removes one redundant tree-object layer; legacy envelopes still load. |
| Saved betting evidence | 10.1 | PERMANENT. No deletion. Owner scoping and original content IDs remain intact. |
| Operational history | 116.9 | REFERENCED HISTORY pending explicit rollup contracts. Keep job receipts, usage accounting and idempotency keys. A completed job is not proof its entire record is disposable. |
| Search indexes | 107.6 | RECONSTRUCTABLE current projections, not historical source of truth. Existing transactional replacement on publication remains. Live search was not dropped to manufacture savings. |
| Structured directories and indexes | 75.6 | Retained; modeled separately from payload bytes. |
| AI cache | 0.4 live | RECONSTRUCTABLE after TTL and lease expiry. Original response remains preserved if another root/pin references it. |
| Temporary processing payload backlog | 0.2 live | TEMPORARY only after full reference verification. Modeled one day of backlog, not an enforced automatic deletion guarantee. |
| GC audit/plan allowance | 36.6 | Planning allowance for existing per-object audits and maintenance overhead. New cache-directory audit totals occupy two cumulative policy rows, not unlimited tombstones. |
| Fixed schema/registry | 2.7 | Fixed allowance; no synthetic empty-table page is treated as free growth. |

Community/Crew, trivia/rewards, commerce, media progress, notification/consent history, quota accounting, authoritative settings and legacy archive directories also have explicit retain-by-default contracts in `retention-contracts.ts`. Their incremental production volumes are unknown and are listed as unmodeled demand; they were not assigned zero or made deletion candidates.

The largest unresolved driver is **canonical editorial history**, followed by source evidence and public versions. Retaining source evidence alone exceeds 350 MB under the stated source-size/volume scenario. That is a workload-specific result, not a mathematical claim that every possible small installation must exceed the limit.

## Safe lifecycle implementation

Additive migration **0043** adds an expiry index and internal cumulative audit table. Root-table layouts and PostgreSQL rollback migrations are unchanged. The existing GC schema fingerprint remains valid: the new table is internal `app_storage_*`, and the added index does not change root-table definitions.

`expireDerivedDirectories` performs one fenced atomic batch:

1. Delete at most 20 AI directory entries whose `expires_at <= now` and `lease_until <= now`.
2. Record removed-row totals and run identity in the same transaction.
3. Delete at most 20 score-directory entries whose board or reference source version no longer matches the existing read contract.
4. Record score removals in the same transaction.

An injected audit failure rolls back deletion. Live responses and active leases survive. The eligible-prefix queue itself is the durable continuation state: retries process remaining eligible rows, including rows inserted behind a previous key. A high-water cursor would incorrectly skip those rows. Repeated drained steps delete zero and do not double-count removals. Cumulative audit timestamps/run IDs may advance; retained data and removal totals remain idempotent.

**No payload bytes are deleted by directory expiry.** Existing verified mark/sweep handles payload roots, transitive JSON references, recovery dependencies and pins. Its durable sweep cursor, atomic capacity/audit updates, and writer epoch fence are reused. A saved or pinned cache payload survives expiry and GC. Existing corruption, concurrent-writer, crash continuation and rollback tests remain enabled.

Maintenance library paths are private; no HTTP cleanup endpoint was added. Owner commands are local-only and explicitly acknowledged:

```sh
export TSX_TSCONFIG_PATH=tsconfig.test.json
export DD_STORAGE_MAINTENANCE=RAW_WRITERS_STOPPED
# Use an isolated local persistence directory. No remote mode exists.
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --expire-derived 20
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --dry-run 5
# Stop all raw/SDK writers before full marking and keep them stopped until done.
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --prepare 5
node --import tsx scripts/collect-sustainable-storage.mjs LOCAL_PERSIST_DIR --step RUN_ID
# Repeat step with the returned run ID until done=true. Resume, never force-unlock.
```

Directory cleanup measures seven statements. Existing single-object sweep steps remain below 12 in their runtime tests. Full graph marking remains owner-local and unbounded in database size; it is **not an online <50-query Worker invocation**. No Cron Trigger or remote ingestion was enabled. The daily lifecycle/admission assumptions depend on actually running owner maintenance; commands alone do not make it automatic.

## Editorial, queries and recovery

Public editorial schema 2 stores version metadata plus a SHA-256-addressed shared body. The body contains only an explicit whitelist of prose/source fields, so it cannot overwrite owner/story identity fields during expansion. Schema 1 still reads unchanged. The new version reader validates story/version identity and publication visibility. A hidden current story does not become public through historical lookup.

All 160 synthetic published versions retained their original bodies and source URLs through GC. The saved article ID still resolved to the current story. Full synthetic encrypted SQL export/restore now also includes a shared-body graph, in addition to accounts, PHCs, sessions, preferences, saved bets, Front Office, FTS and binary/legacy payload rows. All exported tables compare exactly after restore; corruption is rejected and foreign-key checks pass. Offline backup RPO remains 24 hours; hosted RTO is unmeasured. Backups require owner storage and execution.

D1 prefetch now supports both inline and chunked objects while bounding encoded cache allocation at 2 MB. Objects are still decoded and SHA-256 checked before use; the existing verified cache is bounded at 8 MB. Corrupt prefetched chunked objects are rejected. History is processed in groups of 24 to give measured multi-market boards more encoded-memory headroom. No history is truncated and no user action was split into artificial extra requests.

Additional query changes:

- Direct D1 application/Front Office aggregate envelopes avoid wrapping an already compact literal in another immutable object. Legacy tree envelopes and large-value fallback remain. Cold recovery validates direct-envelope reference payloads too.
- Boolean transaction preconditions can share one assertion row while preserving all predicates, writes, parameter bounds and transaction boundaries. Larger parameter sets retain the prior form.
- Public editorial bodies and metadata are prefetched separately; list and historical version readers reconstruct the same product data.

**Complete HTTP request evidence:** final browser/HTTP sample has 1,169 instrumented responses, zero at/above 50 statements, four at/above 30. Checkout remains 48, Crew invite 41, Front Office save creation 36, trivia answer 36. Thus the requested universal <30 headroom is **not achieved**. Unknown cold paths, larger notification backlogs, older many-node graphs and very large history responses are not universally certified below 50.

**Larger local D1 adapter evidence:** 200 generations return all 200 original prices in 20 statements; a separate 32-generation × 2,000-market fixture returns all **64,000 prices** under 30 statements. The 64,000-price fixture measures **eight statements**; exact metrics are retained in `odds-benchmark.json`. These include adapter storage/fence overhead, not HTTP authentication or response serialization; they are not complete HTTP CPU/memory benchmarks. A 40-article list uses six statements. Wire-event payloads are also prefetched in batches; the populated 40-event wire regression uses nine statements. A bulk chunked-payload integrity test uses three. The maximum supported individual 4 MB high-entropy payload test remains enabled.

No DOM, CSS or native screen changed. Browser checks cover Chrome desktop/mobile viewports; Android and iOS devices were not built or visually validated.

## Capacity scenarios and free limits

Official [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) remain 500 MB per Free database and 50 queries per invocation. Account storage does not enlarge one database. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) provides account-wide five million rows read and 100,000 rows written per day; indexed writes count too. These documents were checked this mission; actual account headroom was not accessed.

Independent after-sharing scenario, decimal MB including a 20% allocation reserve:

| DAU | 30 days | 90 days | 180 days | 365 days |
|---:|---:|---:|---:|---:|
| 0 | 397.8 | 1,185.4 | 2,366.7 | 4,794.9 |
| 10 | 398.9 | 1,188.4 | 2,372.7 | 4,807.0 |
| 25 | 400.5 | 1,193.0 | 2,381.8 | 4,825.2 |
| 50 | 403.3 | 1,200.7 | 2,396.8 | 4,855.4 |
| 100 | 408.7 | 1,216.0 | 2,426.9 | 4,915.9 |

Assumptions: 96 new articles/day, four versions/article, 192 source candidates/day, 32 briefings/day, 16 events refreshed three times/week, 2,000 markets/event, continuous-year event envelope, measured synthetic entropy, and independently charged search/directories/operations. User growth starts at two cumulative users/DAU plus 0.1 new users/DAU/day; session history, saved evidence and Front Office revisions grow separately. These are scenario inputs, not observed traffic. Unknown canonical imports, additional product histories, media and attachment sizes remain unknown, never certified as zero. Exact category sizes and all 20 scenarios are in `capacity.json`; regenerate with:

```sh
(cd workers/content-engine && TSX_TSCONFIG_PATH=../../tsconfig.test.json node --import tsx scripts/lifecycle-domain-benchmark.ts)
python3 scripts/project-historical-lifecycle.py
```

The original 64 MB admission limit is unchanged. The new scenario reaches it in approximately **6.14 days** at 50 DAU; the inherited model's approximately 7.18 days remains a different assumption set. These demand projections do not mean writes continue after the enforced admission stop.

At 50 DAU / 365 days, inherited whole-product operations plus explicit cleanup allowance give about **3,955,709 D1 reads/day** and **75,548 writes/day** in the planning case; index/transaction amplification sensitivity reaches **111,962 writes/day**. This is not a measured quota guarantee. Full marking has database-size-dependent read/query cost and still pauses writers. Per-object GC audit/plan costs are allowances; actual orphan churn can change them. Local fixture row metrics are stored beside query metrics; they are not a hosted billing measurement and may not capture the same index-write accounting. Hosted Worker CPU and large-response memory remain unmeasured; successful local workerd execution is not proof of hosted CPU allowance compliance.

No mandatory cloud backup is added. A seven-day, two-copy full offline backup envelope for the 50-DAU annual scenario is about **68 GB owner-managed storage**, before export/base64/compression/encryption variability. That is a planning allowance, not a measured encrypted backup size. Tested restore uses a much smaller synthetic dataset. R2 use remains zero.

## Validation

Final counts and raw logs are in `reports/historical-lifecycle/validation-summary.json` and `regression/`.

- Full root regression: 1,072 passes, zero failures; two pre-existing skips.
- Full Worker regression: **133 passed, 0 failed**. Combined automated total: **1205 passed, 0 failed**, with two pre-existing root skips.
- 48 browser route/theme/viewport checks pass, along with authenticated trade HTTP and the runner's critical product workflow checks.
- 43 additive migrations apply; repeat apply reports no pending migration, with zero foreign-key errors.
- Actual local Worker registration, native-compatible Argon2 verification/login, invalid credentials, reset, concurrent sessions, logout and expiration pass without DATABASE_URL or R2 bindings.
- Encrypted full restore, tamper rejection, original IDs, historical search, saved evidence, user isolation, Front Office CAS/restart, source attribution, transfer regressions and existing GC concurrency/recovery tests pass.
- New lifecycle tests cover bounded continuation, lease protection, reference preservation, cumulative audit idempotency and an injected audit failure rolling back directory deletion.
- TypeScript completion check and changed-file formatting checks pass. No tests were removed. Full regressions retain local emulated-R2 rollback coverage; the dedicated application/browser/authentication/recovery runs explicitly omit R2 bindings.

The first new restore fixture omitted a required search row ID; it was corrected and the complete probe rerun successfully. That was a synthetic test-fixture failure, not a suppressed application failure.

## Remaining blockers and recommended next action

1. **Annual persistent storage is still unsustainable.** Keep the admission guard. A 30% headroom launch is not supported by either planning model. Sharing public prose does not eliminate canonical versions, evidence, odds or user history.
2. **Required retention tradeoff needs an explicit product decision.** Specify whether all canonical drafts/synthesis inputs and all candidate full text are promised forever, which source evidence must remain recoverable, and whether historical odds need every full original board or an exact price/identity projection. No such requirements were weakened here. Reducing those promises would require new, reviewed reader/restore contracts before any deletion.
3. **Fixed content volume matters more than small DAU.** Under this scenario even zero users exceed capacity. If no retention change is acceptable and no additional durable service is allowed, lower future ingestion/publication volume or do not launch. Keep the three-times-weekly odds schedule; reducing the schedule was not used as a saving.
4. **Query headroom is incomplete.** Checkout, invitations and save/trivia mutations remain above 30. Large-response CPU/memory and notification backlog paths require further bounded transaction/delivery design and representative full-request tests.
5. **Online marking is not solved.** Existing owner-window full marking is reference-safe, but scaling it requires additional persistent reference tracking and concurrency validation. Do not expose it as a public Worker endpoint.

Recommended next action: review the local changes and explicitly choose a historical retention/volume contract. Then build a representative fixture for canonical editorial and source ingestion before adopting another annual forecast. **Do not deploy or activate billing.**
