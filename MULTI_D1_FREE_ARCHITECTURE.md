# Multi-D1 Free architecture feasibility

Decision: **NO-GO. Ready for staging: NO.** Ten databases can distribute the base-case storage, but do not establish sustainable operation under the approved workload. Estimated sustainable DAU: **not established at any tested level**. The inherited write-amplification sensitivity already exceeds the account allowance before adding cross-database coordination. No data was removed, retention weakened, admission limit raised, or runtime routing switched.

Baseline: `38aaacd4`, `poc/approved-retention-implementation`. Work isolated on `poc/multi-d1-free-architecture`. Assessment dated 2026-10-19.

## Verified provider constraints

Official [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) confirm 10 Free databases, 500 MB each, 5 GB account storage, 50 queries per invocation, six simultaneous D1 connections, and seven-day Free Time Travel. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) gives **account-wide** 5 million rows read and 100,000 rows written daily; indexes add writes. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [pricing](https://developers.cloudflare.com/workers/platform/pricing/) constrain Free CPU to 10 ms/invocation and requests to 100,000/day. Ten databases multiply neither CPU nor daily operation allowances. Account occupancy/available headroom was not inspected remotely. Existing databases would consume the same ten slots. Decimal MB/GB used throughout.

## Allocation and ownership

All **182 baseline tables**, including FTS shadows and legacy archive tables, are assigned in [table-allocation.md](reports/multi-d1/table-allocation.md). Applying all 44 migrations in disposable in-memory SQLite yields 28 declared cross-role FK edges, enumerated in [capacity.json](reports/multi-d1/capacity.json). JSON/hash references add further edges; this count is not a complete semantic relationship count.

| Database | Teams / purpose |
|---|---|
| TEAM_1 | ARI LAR SF SEA |
| TEAM_2 | ATL CAR NO TB |
| TEAM_3 | BAL CIN CLE PIT |
| TEAM_4 | BUF MIA NE NYJ |
| TEAM_5 | CHI DET GB MIN |
| TEAM_6 | DAL NYG PHI WAS |
| TEAM_7 | DEN KC LAC LV |
| TEAM_8 | HOU IND JAX TEN |
| USER | Accounts, credentials, sessions, preferences, Front Office, saved content/bets, social/Huddle, transactional trivia/rewards/commerce, notifications |
| SHARED | NFL reference/schedule, source registry, observer/operational state, shared trivia questions, catalog, application configuration |

Team editorial, evidence, versions/corrections, public projections/FTS, Three & Out and odds belong to one owner shard. An NFL event belongs to its designated home-team shard; away-team and global views resolve the same IDs. Neutral events need a persisted canonical owner. League-wide editorial/video items also get one immutable owner, with small membership references for other teams. Source registry/checkpoints remain shared; source evidence has one canonical owner and cross-shard references need pins. These ownership rules are design requirements, not implemented migrations.

Storage internals, payload chunks, local epoch/guards, GC and retention audit tables exist separately wherever needed. Hash deduplication is local; there is no free cross-database payload deduplication. Legacy `r2_archive_*` names remain mapped for rollback compatibility; no R2 service is introduced. USER's heads/receipts continue to serve user application documents, not team content objects.

## Storage projection

Reuses `scripts/project-approved-retention.py` and its measured synthetic domain sizes, approved windows and permanent reference exceptions. Four canonical revisions plus head remain a size proxy, not a production measurement. All scenarios include indexes/directories, payloads, user churn, session history, permanent saved evidence, 20% physical reserve, and a conservative full baseline schema/registry allowance in each database (nine extra copies). Schema reserve is not a measured role-specific page count.

Uniform team content is split eight ways. Operational/GC/retention envelope is conservatively charged to SHARED; actual per-shard maintenance would redistribute it and add costs. This allocation is a model, not physical ten-database measurement. Unmodeled domain demand and new saga/pin/directory overhead remain additional; totals are not upper bounds. All twenty scenarios, all ten individual DB sizes, reference sensitivity and offline backups are in the JSON artifact.

| DAU | Days | Each TEAM_1–8 MB | USER MB | SHARED MB | Account MB |
|---:|---:|---:|---:|---:|---:|
| 25 | 30 | 50.9 | 5.9 | 22.1 | 434.9 |
| 25 | 90 | 145.2 | 10.8 | 58.4 | 1230.5 |
| 25 | 180 | 160.6 | 18.2 | 112.9 | 1416.3 |
| 25 | 365 | 192.5 | 33.4 | 224.8 | 1798.0 |
| 25 | 730 | 255.2 | 63.4 | 445.7 | 2551.0 |
| 50 | 30 | 50.9 | 8.6 | 22.1 | 437.6 |
| 50 | 90 | 145.2 | 18.5 | 58.4 | 1238.2 |
| 50 | 180 | 162.3 | 33.3 | 112.9 | 1444.7 |
| 50 | 365 | 197.6 | 63.7 | 224.8 | 1869.0 |
| 50 | 730 | 267.1 | 123.7 | 445.7 | 2706.1 |
| 100 | 30 | 50.9 | 14.0 | 22.1 | 443.0 |
| 100 | 90 | 145.2 | 33.8 | 58.4 | 1253.6 |
| 100 | 180 | 165.7 | 63.4 | 112.9 | 1501.5 |
| 100 | 365 | 207.8 | 124.2 | 224.8 | 2011.0 |
| 100 | 730 | 290.8 | 244.2 | 445.7 | 3016.3 |
| 250 | 30 | 50.9 | 30.3 | 22.1 | 459.3 |
| 250 | 90 | 145.2 | 79.6 | 58.4 | 1299.6 |
| 250 | 180 | 175.7 | 153.6 | 112.9 | 1671.9 |
| 250 | 365 | 238.3 | 305.6 | 224.8 | 2437.2 |
| 250 | 730 | 362.0 | 605.6 | 445.7 | 3947.1 |

At 50 DAU/365 days: total **1.869 GB**, each team **197.6 MB**, USER **63.7 MB**, SHARED **224.8 MB**. All pass the base-case 350 MB target. A team shard with twice the uniform workload reaches **391.9 MB**. If all aged records remain externally referenced, the account reaches **4.949 GB** and a shard **582.6 MB**, exceeding the hard per-DB limit. This is a legitimate retained-reference sensitivity, not a permitted deletion opportunity.

At 730 days SHARED reaches 445.7 MB under this conservative attribution, exceeding the headroom target. At 250 DAU USER reaches 605.6 MB and fails the hard limit; account reaches 3.947 GB and exceeds the practical 3.5 GB target. Sharding therefore does not provide unlimited sustainability. The unchanged **64 MB encoded payload admission guard** can block writes well before physical 500 MB capacity. Removing that guard without qualified physical/operational measurements would not solve the other failures.

Backups are owner-managed encrypted offline full exports, not extra D1 copies. The unchanged approved policy retains two copies of every daily full archive: at 50 DAU one year costs approximately **971 GB owner disk**, including duplicated schema allowance; no incremental/rotation savings assumed. This is an operational burden, not Cloudflare storage. Time Travel is not an account-loss or cross-database-consistency backup. Full export/restore reads and restore writes still consume account quotas if performed remotely.

## Shared operations and query budget

| DAU | Reads/day | Writes/day planning | Writes/day sensitivity | Worker requests/day |
|---:|---:|---:|---:|---:|
| 25 | 3,891,888 | 88,857 | 124,931 | 9,475 |
| 50 | 3,955,709 | 89,548 | 125,962 | 10,916 |
| 100 | 4,083,352 | 90,930 | 128,024 | 13,798 |
| 250 | 4,466,281 | 95,076 | 134,210 | 22,444 |

These are inherited planning envelopes, not measured tenant traffic. 250 DAU is an explicitly affine extrapolation of the existing 0/50-DAU envelope. Background ingestion is included even at zero DAU: reads 3,828,066/day, planning writes 88,166/day, amplified writes 123,900/day, requests 8,034/day. New fanout, saga retries, directory maintenance, full archive scans/restores and per-shard fences are additional. First demonstrated limiting allowance is **shared writes**, with retention admission/reference growth also blocking. No sustainable DAU ceiling can be certified from these assumptions. Worker CPU remains **unmeasured**, and local elapsed time is not hosted CPU evidence.

Existing complete local HTTP instrumentation in `reports/approved-retention/queries.json`: **1,180 samples, maximum 38 statements, zero at/above 50**. Checkout 38; Front Office saves/trivia answers 36. This is reused baseline evidence, not a new ten-DB benchmark. No application changes were made, so it was not rerun. Adapter-level query counts must not be substituted for complete HTTP counts.

Proposed budget: authenticate centrally once; batch references; query a selected team directly. Global search fanout is limited to eight shards in waves of at most six open connections; bounded keyset results merge by stable score/date/ID with a cursor per shard. A design envelope of three central statements plus three per shard is 27 statements before any extra route work; this is **not measured**. A shared request-wide statement counter must include authentication, object prefetch/chunks, retries and outbox work and reserve enough budget before fanout. Reject/defer excess work, preserve continuation state; never silently return incomplete results. All critical endpoints require full cold-cache, legacy/backlog and worst-payload HTTP qualification under 50 before enabling routing. No claim that a hypothetical implementation preserves the measured 38 maximum.

## Routing and integrity design

Keep single-D1 `ApplicationBindings.db` and configuration as rollback. A future explicit versioned multi binding mode supplies `USER_DB`, `SHARED_DB`, `TEAM_1_DB` through `TEAM_8_DB`; never fall back to another shard on an unknown team, missing binding or missing object. Central session verification determines actor identity; client-supplied team cannot grant authority. Resolve immutable content/event ID to owner via a compact versioned directory; original IDs do not change and saved URLs remain valid. Team changes only update central preferences, never move user records. API contracts remain the same.

Do not simply replace `applicationStorage().db` based on request team: existing adapters join users, receipts, payloads, source registry and FTS and assume same-DB fences/transactions. Role-specific repositories and additive schemas must replace cross-role FKs with explicit durable protocols. Local FKs and local transactional guards remain intact. Source versions and ownership-directory updates must use idempotency keys.

Saved articles: pin exact source versions/evidence first on the owner shard, then commit central save with immutable recovery evidence and a unique operation ID. Confirm the pin after central commit. Retry the same operation; failed/unconfirmed operations retain pins until reconciliation proves no committed save. Unsaving is a central tombstone followed by idempotent release. Compensation favors excess retention over data loss. This adds real bytes and writes not credited in the model. Existing same-DB retention cannot safely run across shards until it reads acknowledged cross-DB pins; a remote outage must fail cleanup closed.

Saved bets: central immutable selected odds/evidence plus canonical event/market IDs; source snapshot pin must be acknowledged before completing a save that depends on the source. Front Office state, its command receipt and save remain one USER transaction; external content references use the pin protocol. Global search indexes are projections per owner with version watermarks, not duplicated full canonical bodies. Editorial ingestion uses shared source identity plus deterministic candidate IDs, shard-local commit and retryable publication-directory outbox. Directory publication follows content commit; failed publication is replayed, not compensated by deleting published history.

Recovery: quiesce **all** writers, fence every shard, record one owner manifest of ten encrypted verified exports, ownership mapping, schema versions, content hashes and saga cursors. Restore all ten into isolated local DBs, verify SQL/FTS/FKs plus cross-DB references, reconcile pending sagas, then unlock. Individually restoring one shard is not globally consistent. Existing GC root fingerprints and retention preparation must be redesigned and requalified per role; existing single-DB recovery does not prove this design. Rollback requires preserving the single-DB snapshot plus replaying post-cutover writes; merely changing a binding after split writes would lose data. No cutover or dual writes are enabled here.

## Implementation and validation

The conditional application prototype was **not activated**, because feasibility did not pass. Implemented a reproducible isolated model, fail-closed pure team router used by the model, complete table/FK inventory and nine regression tests. No Worker/application schema, API, authentication, retention or production configuration changed. Existing single-D1 rollback remains intact. No PostgreSQL, R2, paid service, production data, remote resource or deployment was used.

Run `python3 scripts/project-multi-d1.py` and `python3 scripts/test-multi-d1.py`. **9 tests passed, 0 failed**; all 44 migrations apply in synthetic in-memory SQLite. Tests cover all 32 team routes, invalid-team rejection, central auth/FO ownership, local storage ownership, inventory completeness, storage reconciliation, quota/reference failure and baseline HTTP evidence. Output: `reports/multi-d1/tests.txt`.

No new multi-D1 application tests for authentication, saves, Front Office, Parlay, global search, recovery or retention were run: those workflows are **unimplemented/unverified across shards**. Baseline report records 1,208 automated passes and 48 browser passes; these were not rerun or counted as new results. No runtime change warrants repeating the entire unchanged baseline suite. Native/mobile UI unchanged and not device-validated.

## Minimum changes before an application prototype

1. Measure and reduce ingestion/retention/index/fence write amplification enough to provide account-wide headroom, including cross-shard maintenance and recovery budgets. More databases cannot do this.
2. Bound permanent reference and user-history growth without losing required saved evidence; measure canonical payload entropy and skew with worst-size synthetic data. Revisit owner backup disk growth without assuming an untested incremental chain.
3. Build explicit role adapters, durable cross-shard pins/sagas/directory and coordinated restore; qualify schema root/GC changes. Measure physical per-shard pages and payload admission safety.
4. Run complete HTTP cold/warm/legacy/backlog workflows and hosted CPU measurements within Free limits, then validate available account resource slots and quotas before staging approval.

Architecture recommendation: retain the reversible single-D1 local implementation while resolving these blockers. Ten-way partitioning is a possible storage distribution design, **not a qualified Free-plan launch architecture**. Ready for staging: **NO**. No deployment requested or performed.
