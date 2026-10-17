# D1 + R2 storage final results

October 16, 2026. Local POC only, based on `a51c0784`, branch `poc/editorial-d1-r2-storage-optimized`, isolated worktree `/private/tmp/down-distance-d1-r2-storage-optimized`. **Stop for review. No deployment or production integration is authorized by these results.** No production systems, account configuration, paid infrastructure, Front Office, Parlay Lab, or application UI were accessed or changed. Only disposable synthetic fixture bodies were retired; all original editorial/user data is untouched.

## 1. Root cause

The old design archives expanded record values, while most large source payloads remain in shared D1 immutable blobs. Its eligibility deliberately protects NEW candidates, pinned publishing evidence, current stories, and latest editions. Moving a historical revision does not remove a text chunk still referenced by a current candidate or evidence. The POC cohort has 200 candidates, 220 revisions, 83 current stories, 166 story versions, 83 evidence associations, 40 videos, 32 editions, and 2,555 compacted operational records. It models no later terminal candidate transitions. That is conservative retention, not proof those current records disappear after 30 days.

The prior committed page audit, after verified redundant-copy retirement, shows:

| Object                         | Standard bytes | High entropy bytes |
| ------------------------------ | -------------: | -----------------: |
| `editorial_blob_fragments`     |        802,816 |          2,150,400 |
| `editorial_blobs`              |        311,296 |            307,200 |
| `r2_archive_records`           |        196,608 |            196,608 |
| `r2_archive_members`           |         40,960 |             40,960 |
| `r2_archive_manifests`         |         20,480 |             20,480 |
| `archive_records`              |        114,688 |            114,688 |
| Its second unique/dedupe index |         90,112 |             90,112 |

The new archive directories alone consume 258,048 bytes in that cohort. Each member repeats record identity, manifest identity, a hash, and pointer JSON; the pointer also remains in the domain row. PREPARED/ACTIVE manifests repeat long hashes and object keys. `original_json` retains a complete recovery reference until explicitly retired; those references keep immutable roots reachable. Normal runtime never retires them. In the old disposable test, 333 unreachable blobs were removed only after verification and reachability tracing. Even then standard owned allocation increased 94,208 bytes relative to pre-R2. The 828.51 MB projection therefore follows measured retained-page growth, not an R2 upload failure.

Unavoidable under the current contracts: canonical/saved IDs, source and revision pins, team/date/status/search fields, edition/story/video relationships, operational dedupe receipts, and indexes supporting these queries. Reducible: duplicated payload bytes, dead immutable roots, per-record archive pointer/directory duplication, repeated manifest hashes, and repeated recovery copies after a separately approved and verified retention window. Some scalar data is duplicated in JSON and indexed columns intentionally for query performance. It must not simply be deleted as “duplicate.”

The machine-readable final benchmark contains **every table and index**, row counts, per-column logical byte counts, owned B-tree/overflow pages, file bytes and freelist bytes for before/copy/retirement phases. Logical column byte counts exclude SQLite record/page overhead; they are not physical allocation. Categories include active records, historical versions, evidence metadata, candidates/revisions, immutable references, operational archives/directories, jobs/checks/outbox, run history and all explicit/implicit indexes.

## 2. Implemented local architecture and before/after

The selected experiment copies existing immutable **encoded blobs**, rather than expanding each historical record into a second archive representation. Up to 32 blobs share a content-addressed private R2 pack, with a default 128,000-byte payload budget. One normalized pack row stores its SHA-256; nullable location columns extend the existing blob identity row. No second hash directory, domain pointer rewrite, or editorial status reclassification is needed. Existing IDs, JSON envelopes, original hashes, relationships and queryable metadata remain intact. Existing record archives remain supported for backward compatibility.

Additive migration `0008_blob_pack_locations.sql` creates `editorial_blob_packs` and adds three nullable location columns. Migrations 0001–0007 are unchanged. `BlobPacks` is opt-in local code and is not imported by the Worker entry point. Upload is immutable, then read back and verified before an atomic directory batch. A failed/interrupted upload leaves originals intact; concurrent copies cannot overwrite an activated mapping. Reads validate the entire pack digest/range, then the existing payload reader validates the original decompressed hash and length. Missing or corrupt packs fail closed.

Only the guarded, quiesced disposable helper compares every offloaded byte with its local original before clearing redundant fixture bodies/fragments. It preserves every blob identity. Runtime has no eviction or deletion API, and automatically retains originals. The lower projection is **conditional on eventual verified retirement**, not the storage behavior of an unconfigured deployment. Direct packing conservatively retains unreferenced blobs too, including obsolete roots, in both inventory and R2; it does not assume an unimplemented runtime garbage collector. The prior guarded record-archive cleanup remains available to its existing tests.

| Fixture / phase  | File bytes | Owned bytes | Reusable free bytes |
| ---------------- | ---------: | ----------: | ------------------: |
| compact / before |  3,002,368 |   2,347,008 |             655,360 |
| compact / copied |  3,002,368 |   2,355,200 |             647,168 |
| compact / after  |  3,002,368 |   1,507,328 |           1,495,040 |
| entropy / before |  4,276,224 |   3,796,992 |             479,232 |
| entropy / copied |  4,276,224 |   3,805,184 |             471,040 |
| entropy / after  |  4,276,224 |   1,507,328 |           2,768,896 |

The selected design retains **1,142 blob IDs**, uses **36 immutable packs**, and clears only their verified disposable body copies. R2 bytes per cohort: **813,528 standard / 1,747,235 entropy**. Both modes retain **1,507,328 owned D1 bytes** after retirement. Of those, the existing blob identity/location rows alone occupy **438,272 / 442,368 bytes**, despite empty local bodies. Operational identity/dedupe directories cost another **204,800 bytes**. All SQLite indexes together occupy **438,272 bytes (29.1% of the post-retirement owned allocation)**. Remaining D1 growth is largely identity, relationship, indexed metadata and compact JSON overhead, rather than a hidden payload upload failure.

| Local measure                                       |  Standard |   Entropy |
| --------------------------------------------------- | --------: | --------: |
| Packing + verification + retirement D1 reads        | 41,117.00 | 49,681.00 |
| Packing + verification + retirement D1 writes       |  3,603.00 |  5,728.00 |
| Packing + verification + retirement R2 GET attempts |  1,250.00 |  1,250.00 |
| Packing R2 PUT attempts                             |     36.00 |     36.00 |
| Local wall ms                                       | 30,008.01 | 26,213.34 |
| Node coordinator CPU ms                             | 12,266.34 | 11,663.97 |

compact: five historical lookups read **50 D1 rows**, perform **15 R2 GETs**, write **0 rows**, and take median/max **33.94/37.40 ms** locally.

entropy: five historical lookups read **50 D1 rows**, perform **15 R2 GETs**, write **0 rows**, and take median/max **43.36/70.85 ms** locally.

No VACUUM or file rewrite was used. Reclaimed pages become reusable; unchanged file size is reported rather than hidden. The old record archive's 41 objects/317 members compare with the direct design's shared blob packs, which also cover payloads still pinned by active records. Their byte populations differ: the direct option includes current shared payloads and retains unused blobs, so R2 totals must not be compared as if coverage were identical.

## 3. Architecture comparison and 365-day projections

| Days | Prior standard D1 MB | Direct standard D1 / R2 MB | Prior entropy D1 MB | Direct entropy D1 / R2 MB |
| ---: | -------------------: | -------------------------: | ------------------: | ------------------------: |
|   30 |                82.32 |               82.32 / 0.00 |              132.33 |             132.35 / 0.00 |
|   90 |               217.10 |             158.11 / 61.01 |              361.17 |           219.81 / 131.04 |
|  180 |               417.20 |            261.55 / 152.54 |              701.17 |           323.25 / 327.61 |
|  365 |               828.51 |            474.18 / 340.66 |             1400.05 |           535.87 / 731.65 |
|  730 |                    — |            893.69 / 711.84 |                   — |          955.38 / 1528.83 |
| 1095 |                    — |          1313.19 / 1083.01 |                   — |         1374.89 / 2326.01 |
| 1825 |                    — |          2152.21 / 1825.35 |                   — |         2213.91 / 3920.36 |

Thirty days hot, seven recovery cohorts, 15% page-growth reserve, inherited initial/scratch reserve and 25% R2 retry reserve. The standard 365-day D1 budget drops **42.77%**, but remains **124.18 MB over target**. Entropy remains above the 500 MB single-database cap. The retained post-archive slope is **999,424 bytes per daily cohort** in both fixtures; hot/recovery entropy cohorts account for the remaining difference.

| Option at day 365         |         Standard storage MB |          Entropy storage MB | Daily D1 reads standard / entropy | Daily D1 writes standard / entropy |
| ------------------------- | --------------------------: | --------------------------: | --------------------------------: | ---------------------------------: |
| A: one D1                 | 474.18 total; 474.18 max DB | 535.87 total; 535.87 max DB |                 623,147 / 634,995 |                   97,015 / 102,328 |
| B: two D1                 | 476.18 total; 298.36 max DB | 537.87 total; 336.92 max DB |                 623,147 / 634,995 |                   97,015 / 102,328 |
| C: three D1               | 478.18 total; 199.57 max DB | 539.87 total; 225.28 max DB |                 623,147 / 634,995 |                   97,015 / 102,328 |
| D: PostgreSQL + 95% cache |    299.87 PG planning proxy |    300.00 PG planning proxy |                             0 / 0 |                              0 / 0 |

For D, estimated origin row reads are **31,158 / 31,750 per day**; durable database writes remain **97,015 / 102,328 per day** in this comparative workload proxy. All four options retain the same modeled R2 bytes: **340.66 / 731.65 MB** at day 365, with **1,350 Class A and 159,375 Class B attempts per 30 days** for either fixture. PostgreSQL caching affects request reads, not immutable storage or durable write requirements. Worker CPU is unmeasured for **every** option. Operational complexity progresses from one graph plus private objects (A), to cross-database routing/integrity/restore coordination (B/C), to a provider, pooling, cache invalidation and backups (D).

Complete horizon-by-horizon A/B/C/D storage, daily operations, R2 budgets and assumptions are in `measurements/storage-final-projection.json`. Shard numbers are optimistic size models and cannot be treated as an implemented integrity-preserving split.

A is the implemented local single-graph design. B/C are **unimplemented partitioning models**, not benchmarks or validated migrations: divide A's storage evenly, allow 25% shard skew and 2 MB extra scratch per additional database. Daily operations are account-wide and unchanged as an optimistic lower bound; routing and cross-shard joins/backup coordination would add work. Real graph partitioning requires preserving relationships across boundaries; SQLite foreign keys cannot enforce relationships across D1 databases. Splitting 32 teams also requires explicit handling of national stories, sources and multi-team videos.

D models PostgreSQL retaining the same relational data with R2 payloads and a 95% request-cache hit rate. Storage is a deliberately explicit planning proxy: initial reserve plus 1.5 times the measured one-cohort logical relational bytes per day. It is **not PostgreSQL on-disk measurement**; MVCC, indexes, WAL, backups, vacuum behavior and provider accounting need a separate benchmark. Modeled reads fall to 5% of the comparable read workload; every durable write remains. D1 reads/writes are zero in this option. No hosted PostgreSQL provider, universal free tier, paid service or caching service is assumed or activated.

Read/write models include the measured full-day workload, packing/verification/synthetic retirement, the inherited 400,512 read and 512 write control-row allowance, 1,000 daily historical lookups, and 25% operation reserve. These are workload assumptions, not observed production traffic. Cold-history retrieval is measured without a pack cache. R2 monthly Class A/B counts include archive work, verification and 1,000 history lookups/day, with 25% reserve. Backups, other account users and arbitrary restore bursts need additional headroom.

The selection query currently scans blob identities, and verification traverses all fixture bodies. One-cohort daily operation numbers are **lower bounds at later horizons**; year-scale selection cannot be claimed to stay constant. Query plans show two primary-key probes for an individual packed blob and indexed source-to-revision history lookup. A partial pending-location index would add an index write on insertion and another on retirement of each entry; a durable indexed cursor should be benchmarked before adding that cost. Existing dedupe/source/history indexes were retained because their removals would break constraints or increase reads.

An adversarial selection-order sensitivity (not a measured multi-year run) adds `(packs/day + final empty probe) × prior cold blob IDs` to daily scanned rows, then applies the 25% reserve. With 36 packs and 1,142 blob IDs per cohort, older hashes preceding new work can produce:

| Day | Standard daily D1 reads with worst-case selection scan |    Entropy |
| --: | -----------------------------------------------------: | ---------: |
|  30 |                                                623,147 |    634,995 |
|  90 |                                              3,739,380 |  3,751,228 |
| 180 |                                              8,492,955 |  8,504,803 |
| 365 |                                             18,264,192 | 18,276,040 |

This scan sensitivity exceeds the account read limit at later horizons. It is another reason neither one nor several D1 databases is currently qualified. Bounded durable selection is required; 32-member output limits alone do not bound rows scanned.

Pack sizing: 8/16/32 members imply at least ceil(N/8), ceil(N/16), ceil(N/32) object groups before byte limits; the measured choice is 32/128 KB. Larger 256 KB packs reduce object overhead but increase whole-pack read/verification memory and CPU; smaller 32 KB packs increase upload/read operation fan-out. These are evaluated tradeoffs, not measured timing claims for alternate sizes. Oversized encoded blobs fail with originals retained; automatic byte splitting is not implemented. No pack size is assumed to fit a Free Worker invocation without actual CPU/subquery validation.

## 4. Free-tier feasibility and recommendation

**No option is qualified to satisfy all requested constraints.** Keep the normalized shared-blob approach as the next local candidate, retaining one relational graph until storage/operations justify a reviewed partition. Extra databases address a per-database cap, not the aggregate <350 MB goal or account write budget. PostgreSQL cannot be declared free without a chosen provider and measured retention/cache behavior. Do not delete attribution, evidence, editions, historical records or saved identities to force a passing result.

Published limits checked October 16, 2026: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) gives 5 million reads/day, 100,000 writes/day and 5 GB total storage; writes include index maintenance. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) gives 500 MB per Free database and ten databases. These are shared account allowances; extra databases do not multiply daily operations. Other account consumption was not inspected.

[R2 Standard pricing](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month, 1 million Class A and 10 million Class B operations/month across the account. Typical modeled archive storage/operations must share these allowances with other buckets and backups. The included allowance is not a hard spending cap. No billing feature was activated. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/) specify 100,000 Free requests/day, 10 ms CPU per HTTP request, and D1's Free invocation query ceiling must also be respected. Local host timings do not qualify any of these runtime limits.

Worst valid content sensitivity: a tested 490,000-byte poorly compressible source encodes to 320,572 compressed 4 KB chunk bytes. At 200 new unique sources/day and 30 days hot, **source bytes alone reach 21.48 GB at day 365**, excluding other content, backup and retry reserve. They approach 9.62 GB by day 180. Thus even perfect D1 metadata compression cannot guarantee this worst-size workload within the R2 included allowance. The complete size sensitivity extends to five years in `measurements/storage-size-sensitivity.json`. Larger valid JSON structures and other maximum-content populations could be worse; no universal worst-case free claim is made.

## 5. Validation

- **56/56 tests passed**, including all original 53 and three new tests. New coverage includes near-512 KB JSON round trip, preserved blob counts with zero redundant fixture body/fragment bytes, explicit local body restoration, immutable copy retry, upload rejection, missing/corrupt packs, persistent emulator restart, saved ID resolution, corrections, source attribution, metadata-based historical search, Film Room, two dated Three & Out editions, and legacy record-archive restoration after shared-blob offloading and restart.
- Existing corruption recovery, record archive/restore, concurrent activation/rollback, historical ID, job/outbox dedupe, current/pinned-data protection, response parity and 32-team tests remain passing.
- TypeScript check, credential-cleared Worker dry-run build and independent SQLite page-audit tests (**2/2**) passed. Evidence is in `measurements/storage-final-validation/`. Initial sandbox attempts failed because localhost binding was denied; successful emulator runs used local loopback permission and disabled outbound requests. An earlier exploratory record-plus-blob run was invalidated by a schema change while running and is not used as final evidence.
- Physical allocation and D1 row meters are local Miniflare/SQLite measurements. Host CPU is Node coordinator process CPU, excluding workerd and child-process CPU; wall time includes local orchestration. **Production Worker CPU was not measured.** Five retrieval samples yield an empirical median/max, not a production p95. Restore timing for the old design is available in the committed baseline; new explicit restoration is correctness-tested, not a production throughput benchmark.
- 30/90/180/365-day and 2/3/5-year projections extrapolate measured one-day cohorts. They are not multi-year load tests or proof of stable page packing/scan costs. Historical search coverage is source/revision metadata and payload retrieval; there was no preexisting full-text history engine to validate, and one is not fabricated here.

Reproduce locally: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:pages`, `npm run benchmark:storage-final`, `npm run qualify:storage-final`, `npm run benchmark:storage-sizes`, and `node --import tsx scripts/storage-final-query-plans.ts`. `benchmark:storage-record-archive` provides an optional combined record/archive comparison; it is not the selected architecture. No CLI command uses `--remote` or performs deployment.

## 6. Remaining production blockers and integration recommendations

1. The <350 MB aggregate target, account-wide operation headroom and worst-size R2 boundary remain unresolved. Define representative source-size/lifecycle distributions and account budgets without silently truncating or discarding content.
2. Normal runtime still keeps originals. A separately approved verified-retirement policy needs recovery windows, independent object backup, reference accounting, admission control, durable bounded cursors, retry/resume checkpoints and orphan inventory. A directory SQL batch fitting 50 statements does not mean the complete coordinator fits 50 queries or 10 ms CPU.
3. Direct binary packs depend on the D1 blob inventory for hashes/codecs/ranges and relationships. R2 alone is not a D1 backup. Back up the relational graph and blob inventory together; design self-describing/exported inventory and disaster recovery before any retirement outside synthetic tests. The POC exposes no production restore/rollback or GC endpoint.
4. Rehearse current-record R2 dependency, missing-object incidents and explicit rehydration against an isolated representative export. Verify saved links, source history, editions, all team feeds and Film Room. Keep readers available until every offloaded blob and legacy record pointer has been restored. Never remove R2 objects or revert readers first.
5. Measure actual Free Worker CPU, subqueries, memory, cache hit rates, maximum pack sizes, concurrent edits/restores, multi-day scan amplification and backup operations in a separately approved staging exercise. No production rehearsal was performed here.
6. Retain schema history and original IDs. Review migration/reader boundaries and account-wide quotas before any integration. Do not merge, push, provision infrastructure or deploy this POC as a consequence of this report.

Commit eligibility: the complete 56-test critical suite and local build/type/page checks passed before committing. The commit is for review only; storage/free-tier qualification failure is explicitly retained.
