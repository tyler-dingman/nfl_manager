# Multi-D1 capacity qualification

**Feasibility: FAIL. Routing gate closed.** No cross-database routing, automatic team moves, production access, remote resource creation, billing or deployment occurred. No referenced data was removed. Work is isolated on `poc/multi-d1-capacity-qualification`, baseline `db07ea56`. Assessment: 2026-10-19.

## Required result fields

- Writes before: **125,962/day sensitivity; 89,548/day planning**, at 50 DAU.
- Writes after: **daily workload unqualified; retain 125,962/day sensitivity and 89,548/day planning with zero speculative savings credit**. Measured duplicate candidate retries improve 6→0, identical score retries 3→0, repeated candidate status 3→2 accounted rows written.
- Base storage per team shard: **197.6 MB** at 50 DAU/365 days.
- Worst-case retained-reference storage per uniform shard: **582.6 MB**.
- Total account storage: **1.869 GB base / 4.949 GB retained-reference sensitivity**.
- Maximum complete HTTP query count: **38** in the new local browser run (1,157 instrumented responses, zero at/above 50). Profiled background article adapter maximum: **58 statements**, separately scoped below.
- Tests passed: **1,210 unique Node automated tests, 9 Python model tests, 48 browser routes**. Two pre-existing root-suite skips. TypeScript check passed. Original/optimized profiling reruns are not counted as extra unique tests.
- Tests failed: **0 final failures**. A fixture assertion initially counted the source payload as a candidate; fixed to compare the candidate allocation delta. Local socket tests require the sandbox permission used for the passing runs.
- Ready for multi-D1 staging: **NO**.

Current official [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/) were checked: reads/writes are account-wide; indexes affect rows written; 10 Free DBs, 500 MB/DB, 5 GB account, 50 queries/invocation. No account-specific availability was inferred from published allowances. The requested 350 MB / 3.5 GB / 70,000 writes are stricter engineering targets.

## Measured write analysis

[Before](reports/multi-d1-qualification/write-samples-before.json) and [after](reports/multi-d1-qualification/write-samples.json) are synthetic **actual local workerd D1 metadata**, with fresh adapter caches on retry, no R2 bindings and DATABASE_URL absent. `scripts/benchmark-write-qualification.mjs` loads original adapters from the exact baseline commit into temporary sibling files, runs the identical fixture before/after and removes those copies. It never overwrites runtime modules. Each raw statement/batch member is recorded before fencing can strip guard metadata.

| Operation | Before rows written | After rows written | After logical changes including guards | Before → after statements |
|---|---:|---:|---:|---:|
| candidate-first | 11 | 11 | 7 | 11 → 12 |
| candidate-retry-new-random-id | 6 | 0 | 0 | 12 → 3 |
| candidate-status-first | 3 | 3 | 3 | 3 → 3 |
| candidate-status-retry | 3 | 2 | 2 | 4 → 4 |
| article-first-published | 50 | 50 | 37 | 52 → 52 |
| article-correction | 47 | 47 | 43 | 58 → 58 |
| source-check-success | 4 | 4 | 3 | 3 → 3 |
| job-enqueue | 6 | 6 | 3 | 3 → 3 |
| odds-first | 26 | 26 | 22 | 36 → 36 |
| odds-identical-observation-retry | 0 | 0 | 0 | 4 → 4 |
| odds-new-timestamp-unchanged-price | 12 | 12 | 10 | 18 → 18 |
| scores-first | 7 | 7 | 7 | 11 → 12 |
| scores-identical-retry | 3 | 0 | 0 | 5 → 3 |
| scores-changed | 7 | 7 | 7 | 11 → 12 |

Logical changes here are the sum of `meta.changes` on mutation statements, including guard insert/delete and explicit assertion work. They are not just business-domain rows: a status change is one domain row plus two fence mutations. `rows_written` is the local D1 accounting metric, including index/FTS work as reported by that runtime. The difference between the columns is not a universal multiplier or physical disk-I/O count. Production D1 must verify the local accounting behavior. Statements count reads, writes and guards individually, even when sent in a batch; a transaction is not one query.

A first article writes a canonical head, version/synthesis/evidence, decision/event and a separate public projection/history/search entry. Corrections intentionally add historical records. First candidates carry immutable payload reservation plus unique/indexed identity rows. Source polling updates success/check/schedule and latency counters; blindly skipping these would damage scheduling and observability. Enqueue writes a job plus guards/unique indexes; claims and completion add further work. Odds preserve observation timestamp and original market directory. A later timestamp remains a new historical observation even if the price is unchanged. The three-times-weekly odds schedule was **not changed**. Existing identical timestamp retries already cost zero writes.

Lab Score source checks include event board, reference version, model and opponent/season/team context. Changed rows for unchanged sources are still persisted, preventing false deduplication across model outputs. Same-source/same-output retries now verify existing immutable bytes and return without an upload/upsert; `computed_at` remains the original computation time. Stale source publication still rejects. Candidate uniqueness is checked before object allocation; original INSERT constraints still arbitrate concurrent races. A simultaneous first-ingestion race may still leave a redundant immutable object for verified GC; no impossible exactly-once guarantee is claimed. Repeated identical status updates use a null-safe SQL predicate; two fence writes remain necessary.

New content adds one indexed preflight read/statement (candidate-first 11→12, score-first 11→12); retries reduce statement counts. Immutable content-addressing already deduplicates odds tree bodies, so replacing timestamped history with a single latest object would sacrifice evidence. No audit or recovery history was removed and no indexes were dropped speculatively.

### Whole-product instrumentation and gaps

The prior complete HTTP trace's largest single write sample was **catalog initialization: 1,017 rows**, a first-seed operation, not a daily request charge. Other measured maxima include Trivia creation 69, answer 47, checkout 37, auth signup 34, Front Office save 28. Authentication/session rotation/revocation and transactional Front Office heads/receipts must retain their guards. These samples are a synthetic request mix, not daily frequency evidence; aggregating their sums into DAU demand would be misleading. Route statistics are in the qualification capacity JSON.

The new browser run exercises authentication, private owner isolation, saved content, Front Office state, Trivia, checkout, scheduled-job readiness and persistence across restart. See [query evidence](reports/multi-d1-qualification/queries.json) and [browser results](reports/multi-d1-qualification/browser/browser-results.json). Existing broad Worker tests cover retention, corruption, recovery, ingestion and no-R2 objects. They are not a measured complete daily ingestion workload.

The inherited daily write model contains a **67,711/day fixed intercept** from earlier capacity modeling, plus explicit object/fence/cleanup allowances and an assumed **14,000/day retention overhead**. That fixed intercept is not measured attribution to individual source fetches, versions, jobs or indexes. Thus 125,962 is a sensitivity estimate, **not an observed production failure rate**. A complete daily ranking by domain cannot honestly be reconstructed from existing instrumentation. Operational status and audit rates, full archive/restore costs, index writes at realistic cardinalities and source polling volume remain unqualified. No unsupported daily savings were subtracted.

At 50 DAU, reaching 70,000 from the sensitivity envelope needs **55,962 fewer writes/day**, before new cross-shard work. A hypothetical retry saving is `6*C + 3*S + T` for duplicate candidates, identical scores and redundant statuses respectively, but the daily C/S/T rates are unmeasured. Even removing every assumed retention write would not meet the target, and removing required audits is not acceptable.

### Query and CPU gate

Published article creation/correction profiles use **52/58 raw statements** through local D1. These tests call adapters from the harness across binding RPCs; they do not prove a successful single deployed Worker invocation at those counts. If called within one Worker request, those sequential operations exceed the 50-query budget. This newly measured background path needs resumable, fenced publication preparation or fewer safe round trips before a multi-D1 ingestion POC. Do not confuse it with the measured **38-statement complete HTTP maximum** or claim the requested under-30 target was achieved. Four HTTP samples remain at/above 30. Worker CPU remains unknown; local elapsed time is not hosted CPU.

## Shard capacity and retained references

The approved worst-case is all aged records remaining referenced, including unknown notification/observer links and content-to-content references. Cleanup examines all durable SQL and recursively referenced JSON/hash roots. It deliberately fails closed and substring matching can over-retain. At 50 DAU all historical odds boards are already retained in the base model because ten saves/day conservatively cover the 16/7 events/day envelope. Therefore **odds contribute zero to the increase from base to 582.6 MB**.

Extra retained bytes before 20% reserve across all team shards:

| Component | Extra MB |
|---|---:|
| Canonical versions, heads and correction evidence envelopes | 1,612.4 |
| Public editorial projections/history | 365.6 |
| Source evidence for retained articles | 422.5 |
| Three & Out references | 34.8 |
| Search indexes | 79.0 |
| Structured historical directories/indexes | 52.7 |

The sensitive editorial history has no approved permanent hard cap: references preserve IDs, corrections, attribution and source evidence. The model retains its explicit worst-reference assumption; it does not pretend that a better reference parser proves all those references obsolete. Canonical compression remains a synthetic proxy. A measured canonical shared-body/delta representation with fully verified historical reconstruction could reduce this term, but no untested savings are credited.

### Saved-bet extraction experiment

`prepareSavedOddsEvidence` is an isolated preparation utility, **not wired into saves or cleanup**. It verifies the immutable source board identity, timestamp and tree, requires unique selected market IDs and complete original player/book/market/line/odds/side identities, retains **every field** of each selected market and SHA-verifies/read-backs the new immutable envelope. The 2,000-market synthetic fixture verifies exact selected rows and source retention, rejects missing/duplicate selections, wrong event IDs and incomplete player identity.

This demonstrates a possible compact selection representation, not complete retirement eligibility for every existing saved bet. Legacy saved metadata is arbitrary JSON and may omit snapshot time/player/provider identities. Transfer, notification, recovery and user references also require reconciliation. The prepared envelope deliberately retains its source hash, so the existing GC still protects the board. No referenced board was deleted or unpinned. A production replacement needs a typed complete evidence contract, durable migration receipt, source-verifiable comparison of every saved selection, recovery validation and explicit retention/GC schema support before release.

Even granting a **more optimistic counterfactual than extraction**—only 30 days of odds/score payloads, zero older saved-board/score cost—the all-reference team shard is **535.7 MB**. It still fails 500 MB and 350 MB. Extraction is useful but cannot qualify this architecture by itself.

### Mapping comparison

Exactly eight team DBs remain available after reserving USER and SHARED. All four deterministic strategies are in the JSON, including all 20 time/DAU scenarios. No online migration exists. Seasonal fixture assumptions give four synthetic teams 3× the ordinary volume; these are **not measurements of those NFL teams**.

| Strategy | Worst team MB at 50 DAU/365 days, synthetic skew + all references |
|---|---:|
| A: existing fixed four-team groups; high teams concentrated | 1,393.8 |
| B: uneven static team counts (2/3/4/4/4/5/5/5) | 814.4 |
| C: deterministic greedy capacity-aware mapping | 582.6 |
| D: four dedicated high-volume teams, seven ordinary teams in each remaining DB | 814.4 |

Capacity-aware static assignment is the best candidate **after actual team-volume/entropy/seasonal measurements**; it cannot solve the current aggregate retained-content bound. In the uniform best-balanced reference case, all eight teams' DBs already average 582.6 MB. By the pigeonhole principle, remapping those bytes among eight DBs cannot put every DB below 500 MB. Non-team USER/SHARED reserves and local schema copies still apply. This is a conditional lower-bound argument on the model, not a claim real teams produce equal bytes.

## Rebuilt 0/25/50/100 DAU model

[capacity.json](reports/multi-d1-qualification/capacity.json) includes all ten DB allocations, per-component base/reference bytes, 20 scenarios, all four mappings, schema overhead, operations before/after, query/CPU qualification and backup bytes. Decimal MB/GB. Approved 90-day article, 7-day processed candidate, 30-day briefing/general odds and permanent saved-reference exceptions remain unchanged. Physical/index reserve is 20%, and ten full schema/registry allowances are charged conservatively. Extra cross-shard directory/pin/saga and per-shard maintenance costs are additional, not assumed free.

| DAU | Days | Each team base MB | USER MB | SHARED MB | Worst team MB | Base account MB | Reference-case account MB |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 30 | 50.9 | 3.2 | 22.1 | 50.9 | 432.2 | 432.2 |
| 0 | 90 | 136.8 | 3.2 | 58.4 | 146.1 | 1155.7 | 1230.4 |
| 0 | 180 | 138.0 | 3.2 | 112.9 | 288.9 | 1219.9 | 2427.6 |
| 0 | 365 | 140.5 | 3.2 | 224.8 | 582.6 | 1351.9 | 4888.5 |
| 0 | 730 | 145.4 | 3.2 | 445.7 | 1161.9 | 1612.2 | 9743.9 |
| 25 | 30 | 50.9 | 5.9 | 22.1 | 50.9 | 434.9 | 434.9 |
| 25 | 90 | 145.2 | 10.8 | 58.4 | 146.1 | 1230.5 | 1238.0 |
| 25 | 180 | 160.6 | 18.2 | 112.9 | 289.0 | 1416.3 | 2442.7 |
| 25 | 365 | 192.5 | 33.4 | 224.8 | 582.6 | 1798.0 | 4919.0 |
| 25 | 730 | 255.2 | 63.4 | 445.7 | 1161.9 | 2551.0 | 9804.5 |
| 50 | 30 | 50.9 | 8.6 | 22.1 | 50.9 | 437.6 | 437.6 |
| 50 | 90 | 145.2 | 18.5 | 58.4 | 146.1 | 1238.2 | 1245.7 |
| 50 | 180 | 162.3 | 33.3 | 112.9 | 289.0 | 1444.7 | 2457.8 |
| 50 | 365 | 197.6 | 63.7 | 224.8 | 582.6 | 1869.0 | 4949.4 |
| 50 | 730 | 267.1 | 123.7 | 445.7 | 1162.0 | 2706.1 | 9865.1 |
| 100 | 30 | 50.9 | 14.0 | 22.1 | 50.9 | 443.0 | 443.0 |
| 100 | 90 | 145.2 | 33.8 | 58.4 | 146.1 | 1253.6 | 1261.0 |
| 100 | 180 | 165.7 | 63.4 | 112.9 | 289.0 | 1501.5 | 2488.1 |
| 100 | 365 | 207.8 | 124.2 | 224.8 | 582.6 | 2011.0 | 5010.2 |
| 100 | 730 | 290.8 | 244.2 | 445.7 | 1162.0 | 3016.3 | 9986.2 |

| DAU | Reads/day planning | Writes/day planning | Writes/day sensitivity | Worker requests/day |
|---:|---:|---:|---:|---:|
| 0 | 3,828,066 | 88,166 | 123,900 | 8,034 |
| 25 | 3,891,888 | 88,857 | 124,931 | 9,475 |
| 50 | 3,955,709 | 89,548 | 125,962 | 10,916 |
| 100 | 4,083,352 | 90,930 | 128,024 | 13,798 |

Rows/day are inherited planning projections, including background ingestion at zero users, not new runtime measurements. The operation envelope is held conservative across durations; horizon-dependent full scans, recovery/import and growing historical search can add reads/writes. They are not shown as zero or certified under quota. Shared 100,000/5,000,000 limits do not grow with database count. The 70,000 write target fails even the planning envelope at 0 DAU. At 100 DAU the 365-day reference account exceeds 5 GB; at 730 days all reference cases far exceed the account limit. All worst-size/content-reference cases must pass before an affirmative result.

Backups remain owner-managed offline full snapshots, two copies per daily recovery point, with no unimplemented deduplication/rotation credit. At 50 DAU/365 days base-model backup demand is about **971 GB owner disk**, separate from D1 storage. Historical-reference backups could be larger; no upper bound is asserted. D1 Time Travel is seven days on Free and cannot make ten restores atomic. The unchanged 64 MB encoded payload admission guard can reject new payloads before physical per-DB capacity; it was not raised. Both backup scans and restoring into remote D1 would consume shared quotas, and those additional operations are unqualified.

## Validation and next action

- Full root qualification: 1,072 pass, zero fail, two existing skips.
- Full Worker/D1 regression: 137 pass, zero fail. Includes the write regression; the separately added saved-evidence test passes, making 138 unique Worker tests.
- Python partition/model regression: 9 pass; rebuilt model validates all 20 scenarios and four deterministic mappings.
- Browser: 48 routes pass against rebuilt local API Worker; 1,157 complete HTTP samples, max 38, no statement count at/above 50. No native app UI change or device validation.
- TypeScript completion check passes. Original/optimized benchmark passes against synthetic local D1 with R2 absent. Evidence is preserved under `reports/multi-d1-qualification/`; earlier milestone reports are restored unchanged.

Reproduce with `python3 scripts/qualify-multi-d1-capacity.py`, `python3 scripts/test-multi-d1.py`, `node scripts/benchmark-write-qualification.mjs`, the saved-evidence `node --import tsx --test` command from `workers/content-engine`, and existing root/Worker/browser qualification scripts. Local workerd/browser sockets need local execution permission, not cloud credentials. No deployment command is supplied because the implementation gate failed.

Recommended next action: instrument a complete synthetic scheduled-ingestion day with worst-size canonical articles and realistic source revisit rates, index metadata and resumable bounded publication; replace the inherited fixed write intercept with measured per-domain counts. Separately prototype verified canonical version/body compaction and typed cross-content references, then rerun the all-reference lower bound. Do not deploy or implement routing until daily writes including maintenance fit the target and protected history fits every shard. No evidence supports claiming the two blockers resolved, and the measured 58-statement background path is an additional constraint.
