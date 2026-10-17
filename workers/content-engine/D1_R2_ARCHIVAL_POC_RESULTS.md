# Editorial D1 + private R2 archival POC

October 16, 2026. Local implementation for review only. Base `00147a45`, isolated branch `poc/editorial-d1-r2-archive`, worktree `/private/tmp/down-distance-d1-r2`. All changes are inside `workers/content-engine/`. The main checkout is untouched. No production data, PostgreSQL, Front Office, Parlay Lab, existing production API, cloud bucket/database, scheduler, paid service or deployment was accessed or changed. The previous worktrees had been removed during disk cleanup; this worktree was recreated from the committed storage POC. Pinned dependencies were restored from its existing lockfile.

## Decision

**This is a lossless retrieval/recovery POC, not a qualified $0 launch design.** The measured results and projections below determine storage fit; the earlier approximately 330 MB D1 estimate was an unverified allocation assumption. Keeping meaningful records and attribution takes priority over reaching that number. There is no automatic destructive cleanup, scheduler, public archive route, object URL or lifecycle deletion.

## Architecture and eligibility

One shared D1 database continues to hold all 32 teams, canonical/public story identities, current versions, editorial cards, Film Room metadata, evidence/source relationships, publication/job receipts, indexes, source checkpoints and archive directories. R2 holds private, immutable, self-describing historical payload packs. D1 relational fields and IDs are retained when a JSON payload becomes an archive pointer. R2 alone is not a complete database backup: recovering from D1 loss also requires a backup of its relational graph/manifests.

| Data                          | Eligible cold payload                                 | Kept hot / guard                                                                                                                   |
| ----------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Candidate revisions           | Older than explicit cutoff and superseded             | Latest revision; revisions pinned by DRAFT/REVIEW/PUBLISHED stories; all revisions with legacy unknown pins used by those stories  |
| Candidate current record      | Explicit REJECTED/ARCHIVED status, older than cutoff  | NEW/active candidates, pending/running candidate jobs, references from current publishing                                          |
| Story versions                | Older than cutoff and below current canonical version | Current version, current canonical story, saved identity and source relationships                                                  |
| Evidence                      | Old payload for WITHDRAWN story only                  | Current publishing evidence, IDs, source/candidate/revision FKs and timestamps                                                     |
| Jobs                          | Old DONE/DEAD payload only                            | PENDING/RUNNING, including expired recoverable leases; durable dedupe/state receipt remains                                        |
| Source checks                 | Old detail JSON                                       | Source identity, attempted time, success column and latest checkpoint remain                                                       |
| Outbox                        | Old, acknowledged payload only                        | Pending/unacknowledged events; event/aggregate/version receipt retained                                                            |
| Existing D1 operational packs | Old immutable `archive_chunks` payload                | Existing `archive_records` ID directory/dedupe keys and daily source-check aggregates                                              |
| Three & Out                   | Old PUBLISHED edition below newest per team           | Newest published edition, drafts, relational edition/date/team identity                                                            |
| Shared immutable chunks       | Remain D1 during normal POC operation                 | No runtime blob garbage collector; only the guarded synthetic helper traces reachability and removes redundant unreferenced chunks |

Cutoffs are explicit and cannot be in the future. Callers control retention (the projection uses 30 days hot); operational pack cutoffs are UTC day numbers. There is no inferred terminal candidate status or fabricated historical revision mapping. The conservative benchmark does not reclassify NEW candidates to create savings. Publicly published stories and their currently pinned evidence stay hot indefinitely in that modeled cohort. A production retention policy needs explicit editorial approval and representative multi-day lifecycle measurements.

## Protocol and retrieval

1. Select at most eight eligible payloads, preserving original ID/revision and physical JSON. Unknown kinds are rejected. Serialization preserves all JSON values, original text, attribution and timestamps. Packs are bounded to 256,000 uncompressed bytes; oversized work fails with originals retained.
2. Create a durable PREPARED manifest before object upload. The manifest records SHA-256 object/raw hashes, immutable key, schema/codec versions, counts/lengths, creation/verification timestamps and configurable recovery deadline (seven days by default).
3. Gzip only when beneficial. Object keys are `editorial/v1/<encoded-SHA256>.pack`; existing bytes must match exactly. Conditional put prevents overwrite races. The adapter exposes get/immutable-put only, without public access or delete methods.
4. Read the uploaded object back; verify encoded/raw hashes, length, schema, count, member IDs/revisions and per-value hashes. Before activation, concurrent eligibility and original JSON are checked again.
5. One D1 batch updates payload pointers, records the ID/ordinal/hash directory and original recovery JSON, and activates the manifest. A failed compare-and-swap or later member guard rolls back earlier pointer writes. Interrupted PREPARED attempts leave originals readable and can retry the same content-addressed pack. Duplicate completed attempts are no-ops; concurrent contenders cannot commit partial directories.
6. Repository reads transparently expand pointers through the private bucket when bound. `createLocalRepository` retains its API and initializes the resolver; direct database/repository users must initialize `EditorialR2Archive` on their database. Without an archive reader, archived payloads fail closed. Current responses, IDs, versions, source attribution and saved-link resolution retain their contracts.
7. Missing/corrupt objects, stale/inactive manifests, mismatched directory entries or unsupported codecs fail without fabricating history. There is no fallback that masks missing archive data as an empty record.
8. Explicit restore verifies object/recovery values and compare-and-swaps all targeted fields atomically. `restore(id, true)` can use retained D1 recovery copies if the object is missing/corrupt; modified targets or corrupt recovery copies fail. After synthetic retirement, verified object restore recreates local immutable payload chunks. Repeated successful restore is idempotent.

Normal runtime retains every original recovery copy even after its deadline. Only `test/synthetic-retire.ts`, excluded from Worker imports, can remove expired redundant copies, and only with the named disposable-harness database, temporary fixture directory and literal `DISPOSABLE_SYNTHETIC_ONLY` approval. It verifies every archive/member first, retains IDs/directories/receipts, traces all remaining compact JSON roots, then removes only unreachable blobs/fragments in that synthetic fixture. This is not a deployable retention/GC implementation. Orphan PREPARED manifests/objects are retained; no unverified cleanup is provided. A restored identical pack is not automatically re-archived under its existing RESTORED manifest; it stays readable/hot pending an explicitly versioned future attempt policy.

## Schema and files

Only additive migration `0007_private_r2_archives.sql`: `r2_archive_manifests`, `r2_archive_records`, and manifest-member index. Migrations 0001–0006 remain byte-for-byte unchanged. No automatic migration/repack/import of any existing database.

New files: `src/r2-archive.ts`, `src/r2-bindings.ts`, migration 0007, `test/r2-archive.test.ts`, `test/synthetic-retire.ts`, `scripts/r2-archival-benchmark.ts`, `scripts/r2-project.ts`, `scripts/r2-query-plans.ts`, this report, and `measurements/r2-archival-{benchmark,projection}.json` plus query-plan and validation evidence.

Modified: `src/{database,payloads,bindings,worker-repository}.ts` for transparent optional resolution/reachability inspection; `test/harness.ts` for local R2 and true persistent-emulator restart; `wrangler.toml` for a `remote=false` local R2 binding; `package.json` for archive benchmark/projection commands. No dependency version/lockfile change. Worker still provides no public content/archive API or cron/Queue consumer. Build script remains a credential-cleared dry run.

## Measurements and projections

**Storage target FAIL:** standard 365-day D1 budget **828.51 MB** (prior single-D1 model approximately 790.81 MB); high-entropy case **1,400.05 MB**. Even the conditional post-retirement model exceeds 350 MB and the 500 MB database cap. Normal runtime retains recovery copies indefinitely, so it cannot claim this conditional lower storage budget without a separately authorized retirement design.

Physical allocation, bytes (no VACUUM):

| Fixture | Phase                               | SQLite file | Owned table/index/overflow pages | Reusable free pages |
| ------- | ----------------------------------- | ----------: | -------------------------------: | ------------------: |
| compact | Before R2                           |   2,981,888 |                        2,338,816 |             643,072 |
| compact | Active + recovery copies            |   2,981,888 |                        2,605,056 |             376,832 |
| compact | After verified synthetic retirement |   2,981,888 |                        2,433,024 |             548,864 |
| entropy | Before R2                           |   4,276,224 |                        3,780,608 |             495,616 |
| entropy | Active + recovery copies            |   4,276,224 |                        4,046,848 |             229,376 |
| entropy | After verified synthetic retirement |   4,276,224 |                        3,776,512 |             499,712 |

Both cases wrote **41 immutable packs / 317 payload members**: 20 superseded candidate revisions, 83 story versions and 214 preexisting operational packs. The operational packs retain all 2,555 original records (1,400 jobs, 1,040 checks, 115 acknowledged events), while their original ID/dedupe directory remains in D1. No current edition/current candidate/evidence payload qualified in this cohort; those adapters are covered by targeted tests. The helper verified all manifests/members and removed 333 unreferenced immutable blobs in each disposable fixture.

| Local archival/retrieval measure                                      |              Standard |          High entropy |
| --------------------------------------------------------------------- | --------------------: | --------------------: |
| R2 encoded bytes                                                      |               182,498 |               415,217 |
| R2 uncompressed bytes                                                 |             1,833,528 |             1,833,521 |
| Archive PUT / GET attempts                                            |              41 / 481 |              41 / 481 |
| Archival + verification + synthetic retirement D1 rows read / written |        40,948 / 3,043 |        44,122 / 3,331 |
| Prior-workload daily D1 rows read / written                           |       46,888 / 73,497 |       47,803 / 75,622 |
| Archival phase wall / Node process CPU, ms                            |    14,090.0 / 6,410.3 |    14,558.5 / 7,700.3 |
| Five historical reads: median / observed max, ms                      |         24.11 / 30.07 |         15.21 / 16.52 |
| Five historical reads: R2 GET / D1 read / D1 write                    |            5 / 15 / 0 |            5 / 15 / 0 |
| Restore eight records: wall ms / R2 GET / D1 read / D1 write          | 410.35 / 1 / 116 / 41 | 547.61 / 1 / 179 / 41 |

Exact query plans verify indexed revision CAS, INTEGER PRIMARY KEY operational CAS, and archive-directory probes in `measurements/r2-query-plans.json`. Selection/retirement scans still need bounded production cursors. Small-cohort page packing varies between runs; the 4,096-byte high-entropy owned-page improvement is not a robust storage qualification. Standard owned allocation **increased 94,208 bytes**, despite successful redundant-copy retirement.

| Days | Standard D1 MB | Standard R2 MB | Entropy D1 MB | Entropy R2 MB |
| ---: | -------------: | -------------: | ------------: | ------------: |
|   30 |          82.32 |           0.00 |        132.33 |          0.00 |
|   90 |         217.10 |          13.69 |        361.17 |         31.14 |
|  180 |         417.20 |          34.22 |        701.17 |         77.85 |
|  365 |         828.51 |          76.42 |       1400.05 |        173.87 |

Projected daily D1 reads/writes including 25% reserve: **610,435 / 96,315** standard; **615,547 / 99,332** entropy. The model includes 400,512 additional read/control rows and 512 additional write/control rows/day. Both miss the 70,000-write gate and leave insufficient confidence under the account-wide 100,000-write limit; these figures exclude other account users and require separate restore headroom. Archive-only monthly budgets are approximately **1,538 Class A** and **18,038 Class B** attempts, including 25% reserve, before history retrieval/restore/other bucket traffic. R2 storage/operations fit published allowances in isolation; D1 storage and production CPU remain unqualified.

Method: reproduce the prior full-day workload across 32 teams (200 unique 8 KB candidates, 20 corrections, 80 stories plus national trio with two versions and source evidence, 40 videos, 32 approximately 10 KB editions, 1,040 checks, 1,400 jobs, acknowledged outbox and run logs). Existing lossless D1 operational compaction precedes R2 archival, matching the storage POC. A separate deterministic high-entropy input tests compression sensitivity. No external sources are fetched.

The benchmark models old eligibility explicitly, retains latest editions/current source pins, waits the configured recovery window in synthetic time, then invokes the guarded redundant-copy helper. SQLite coherent read-only backups are audited for every table/index/overflow/free page and integrity. File size, owned pages and reusable freelist are reported separately. No VACUUM/file rewrite is used to manufacture immediate capacity savings. R2 storage is actual encoded object bytes, not JSON byte savings. Local D1 meters include index/guard/verification/cleanup work, with baseline and archival phases separated. Reads trace a single synthetic cohort; selection/reachability scans are not year-scale throughput proof.

Host CPU is Node coordinator process CPU (not workerd/Cloudflare CPU). Local timings and D1 duration are not Free Worker CPU qualification. Five history retrieval samples yield an empirical median/max, not a production p95. Restore measures one eight-record pack after recovery-copy retirement. The projection extrapolates measured page changes relative to the prior daily owned-byte slope, 30-day hot retention, seven recovery cohorts, 15% page-growth reserve, original POC + 2 MB scratch and 25% R2 retry reserve. It is not a 365-day load test, account billing measurement or guarantee of SQLite packing at scale. It conservatively retains current-only cohort data; realistic later editions/terminal candidates could alter eligibility, requiring measurement rather than assumed savings.

## Validation

- Complete local suite: **53/53 passed**, including all 31 prior editorial/storage tests and 22 archival tests. Final source includes indexed primary-key activation/restore predicates and escaped reserved-marker JSON.
- Isolated Worker POC TypeScript check passed; credential-cleared Wrangler Worker dry-run build passed. No cloud resource was created. Independent SQLite page-audit tests: **2/2 passed**.
- Earlier sandboxed attempts could not bind loopback ports (EPERM); emulator runs were repeated with local networking permission. Those denied attempts are not counted as passes.
- Reproducible commands: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:pages`, `npm run benchmark:archive`, `npm run qualify:archive`. Validation logs are retained under `measurements/archival-validation/`.

Failure coverage includes upload rejection; corruption/missing object; duplicate and concurrent attempts; interruption and resumable PREPARED state; revision/eligibility changes before activation; later-member guard failure rolling back earlier writes; stale pointer/directory mismatch; actual D1/R2 emulator restart; recovery window; explicit restore with/without originals; corrupt recovery data and changed restore targets; historical/saved IDs; author/source attribution; current-publishing/legacy unknown pins; operational dedupe and pending-work protection; edition response/date/source-link parity. Original D1 data remains recoverable on failures. Existing tests continue to cover all 32 teams, national sources, feed/video associations/pagination, SQLite constraints, job claims and expired leases. No browser/native application/API was modified; UI/device validation is outside this isolated storage POC.

## Published allowances and free-tier limits

Published documentation checked for this task; **effective account usage/plan/billing controls were not inspected**. Quotas are shared with other databases, buckets and Workers, not allocated solely to this POC.

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free 500 MB/database, 5 GB total account storage and ten databases. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): 5 million rows read/day, 100,000 rows written/day, including index writes. More databases do not create unlimited account storage/operations.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard storage includes 10 GB-month, one million Class A and ten million Class B operations/month. These are account-level included allowances, not an automatic hard spending cap. Infrequent Access is not assumed free. Archive retention, retries, restore/verification and all other buckets count. No R2 service/payment configuration was activated.
- [Worker limits](https://developers.cloudflare.com/workers/platform/limits/): Free 100,000 requests/day and 10 ms CPU per HTTP request. Initial planning traffic approximately 24,000 invocations/day leaves arithmetic request headroom, but pack/verification/restore orchestration is not implemented as production invocations and CPU remains unqualified. Local multi-second coordinator work cannot be assumed to fit one Free invocation.

Daily writes target <70,000 is an engineering headroom gate, distinct from the published 100,000 limit. The previous optimized workload already exceeded that gate before R2. Retry/restore reserves and actual account traffic must fit before any launch. A hypothetical 1,000 private history requests/day adds at least 30,000 Class B/month for one object per request, plus verification/restore; this is a scenario, not observed traffic. All request subqueries and client amplification must be counted. No unlimited retrieval assumption or paid fallback is authorized.

## Risks, next phase and rollback

This conservative policy and archive directory format are not a storage-target success. Optimize manifest/member overhead, then measure multiple aged daily cohorts with explicit editorial terminal-state transitions, newly superseding editions and approved source-history retention. Do not relax publishing protection or discard attribution to hit a number. Operational archive selection and synthetic reachability currently scan growing tables; production needs indexed bounded cursors, durable per-stage checkpoints, row-budget admission control and restore reservations. Pack size/memory/CPU and cold-read fan-out require real Free-plan rehearsal, representative high-entropy data and largest valid records. Oversized batches currently fail instead of automatically splitting; callers must retain and review them.

Before controlled integration: review additive schema/IDs/reader contracts; obtain separate approval; verify account-wide quotas and overage safeguards; back up and rehearse against an isolated representative export; validate cold retrieval and restore drills with inventory checksums; implement bounded staged orchestration, retention authorization, monitoring and import pauses; only then consider a reversible canary. R2 backups/availability, corrupted manifests, permission isolation, hash/codec upgrades and orphan inventory are separate operational responsibilities. No cutover or deployment is recommended by this POC alone.

Rollback locally: stop new archive attempts, keep the archive reader/private bucket available, explicitly restore each ACTIVE manifest, verify historical/saved references and counts, then disable optional R2 binding only after no archive pointer remains in domain payload fields. Keep directories/manifests and original migration history. Never revert readers first while pointers exist, delete objects during restore, drop relational IDs, or assume R2 packs alone reconstruct D1. If an object fails within recovery retention, use explicit verified recovery-copy restore. After those redundant copies are retired, object availability/backups are essential. Preserve PREPARED/orphan objects for investigation; no destructive automatic cleanup.

Implementation commit: `f83f20504b489af2829a2c6be1ba935581ad9ce9`, created after the 53-test critical gate passed. A documentation-only follow-up normalizes captured log whitespace. Stop for review; no merge, push, deployment or production migration.
