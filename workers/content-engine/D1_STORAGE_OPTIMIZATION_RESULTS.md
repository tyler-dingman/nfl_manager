# D1 editorial storage optimization — local review

Date: 2026-10-16. Base: `053992b7`, branch `poc/editorial-d1-storage`, isolated worktree `/private/tmp/down-distance-d1-poc`. All changes are inside `workers/content-engine/`. No production data, PostgreSQL, Front Office, authentication, existing APIs, scheduler, deployment, R2 bucket or paid service was accessed or changed. All records measured here are synthetic.

## Decision

**The optimized single database does not meet the 12-month target.** The modeled 365-day allocation is **790.81 MB**, above D1 Free's 500 MB per database; the model reaches 500 MB around day **228**. Retaining complete evidence and operational history takes priority over declaring compliance. Physical one-day snapshot allocation falls from **6.37 MB to 2.96 MB**; this is substantial improvement, but not a $0 launch qualification.

This is a local lossless optimization, not authorization to migrate. No retention deletion, evidence truncation, history sampling or expiry of saved IDs was used to improve the result. Multi-database, R2 and PostgreSQL alternatives below are planning scenarios, not implemented deployments.

## Implementation

- Additive migrations `0004_lossless_storage.sql`, `0005_evidence_revision_pin.sql`, and `0006_dense_blob_fragments.sql`. Migrations 0001–0003 are unchanged. Existing inline JSON remains readable; there is no automatic repack.
- `src/payloads.ts`: immutable SHA-256 addressed text chunks and typed JSON trees, gzip when beneficial, exact UTF-8 reconstruction, byte-length and checksum validation. Identical source text can be shared across revisions and sources while each record retains its own publisher, URL, author and ID. No semantic merging of independent reports. Small JSON stays inline. Typed trees preserve reserved keys, nulls, unknown fields and Unicode. JSON whitespace is compacted without removing fields.
- Larger JSON in candidates, candidate revisions, canonical records, historical versions, cards, videos, editions and outbox uses references. Indexed relational keys and hot headline/summary columns remain available. Complete versions share immutable chunks instead of requiring a chain of destructive deltas. Edited chunks are retained alongside their originals; edits near chunk boundaries can reduce deduplication.
- Dense 512-byte physical fragments avoid the roughly 1 KB local-payload threshold of SQLite index B-trees. This matters because `WITHOUT ROWID` uses index-style pages: some slightly larger compressed blobs otherwise consume a whole overflow page. Fragment writes and their parent header commit atomically. The bounded path uses at most 40 fragments; larger encoded values use the original inline blob path. Legacy blobs remain readable. The new benchmark uses the final fragment layout; it is not a bulk rewrite of the existing POC state.
- `src/repack.ts`: explicit one-record repack with verified roundtrip and compare-and-swap. Original IDs, revision numbers, hashes and relationships are unchanged. Failed business transactions may leave unreferenced immutable blobs; there is deliberately no garbage collector that could erase evidence.
- `src/archive.ts`: explicit lossless relocation of DONE/DEAD jobs, source checks, and acknowledged outbox records into bounded compressed packs. It verifies the complete copy before a guarded atomic move, retains every field and an ID directory, and keeps completed-job idempotency receipts. Daily source-check aggregates supplement the exact records. Active jobs, expired recoverable leases and unacknowledged events stay hot. `get` retrieves either representation. Oversized packs fail without truncating or removing hot records.
- Candidate revision pins on new evidence prevent subsequent source corrections from rewriting the original attribution. Preexisting NULL pins remain explicitly unproven; no historical revision mapping is fabricated. Existing story/candidate/video/edition identifiers are preserved. Local `storyById`, `historicalVersion` and `candidateRevision` provide direct retrieval.
- New archive-ready indexes bound hot selection. Cold job receipts use two indexed key probes instead of an OR predicate that could scan all archived jobs; an EXPLAIN regression test verifies both lookups. The daily benchmark builds a single cohort and enqueues before compaction, so its row meters do not certify year-scale workload latency. Existing query and relationship indexes are retained; moving immutable operational rows out of hot tables limits their long-term index growth. No speculative index removal was performed.

Physical SQL now contains reference envelopes for compacted JSON. Trusted callers must initialize the compact reader and use repository accessors; raw SQL is a physical inspection interface. No existing application API is connected to this POC.

## Workload and measurement method

The paired inline and compact runs use identical inputs: one full modeled day across all 32 teams, 200 unique 8 KB articles, 20 additional corrections, 80 new stories with two versions, three supporting national stories, 40 videos with two-team associations, 32 approximately 10 KB published editions, 1,040 source checks, 1,400 jobs total, acknowledged outbox records and 32 run logs. Candidate commits already enqueue 220 of those jobs. Ordinary stories use the original fixture sizes. The high-entropy case replaces text with deterministic pseudorandom strings; the separate large-version case uses approximately 12 KB story records. No source network fetches occur.

This replaces the old benchmark's identical repeated article text with unique synthetic inputs, so cross-article compression is not inferred from a single repeated paragraph. Synthetic vocabulary still does not establish the compression distribution of real articles. The original POC's 16,367,616-byte sample and old projection are preserved separately, not rewritten as an optimization success.

`measurements/storage-benchmark.json` records every table and index, row counts, blob byte totals, operation averages and local D1 meters. Python takes a read-only SQLite backup of each quiesced Miniflare database into a disposable local snapshot (including pending WAL pages), then follows each B-tree root and overflow chain, rejects overlapping pages, runs `integrity_check`, and reconciles owned, free and other pages against file length. This avoids estimating physical sizes from JSON lengths. Other pages include SQLite bookkeeping such as pointer maps. `test:pages` independently exercises table/index overflow, WITHOUT ROWID and freelist accounting. No VACUUM or database rewrite is used to manufacture smaller files.

| One-day synthetic run | File bytes | Owned bytes | Reusable free bytes | Other bytes | SQL index bytes |
| --------------------- | ---------: | ----------: | ------------------: | ----------: | --------------: |
| inline                |  6,369,280 |   6,369,280 |                   0 |           0 |         720,896 |
| compact               |  2,961,408 |   2,314,240 |             647,168 |           0 |         421,888 |
| entropy               |  4,255,744 |   3,764,224 |             491,520 |           0 |         421,888 |
| large-versions        |  3,788,800 |   3,633,152 |             155,648 |           0 |         421,888 |

Table B-tree and overflow bytes (SQL index allocations are separate below; primary storage of WITHOUT ROWID tables is included with its table):

| Table                         | Inline bytes | Compact bytes |
| ----------------------------- | -----------: | ------------: |
| `_cf_METADATA`                |        4,096 |         4,096 |
| `archive_chunks`              |        4,096 |        36,864 |
| `archive_records`             |        4,096 |       114,688 |
| `candidate_teams`             |        4,096 |         4,096 |
| `canonical_stories`           |       61,440 |        61,440 |
| `content_candidate_revisions` |    1,921,024 |        40,960 |
| `content_candidates`          |    1,744,896 |        53,248 |
| `content_control`             |        4,096 |         4,096 |
| `content_outbox`              |      446,464 |         4,096 |
| `content_run_log`             |       16,384 |        16,384 |
| `content_sources`             |       20,480 |        20,480 |
| `editorial_blob_fragments`    |        4,096 |       851,968 |
| `editorial_blobs`             |        4,096 |       430,080 |
| `editorial_cards`             |       12,288 |        12,288 |
| `film_room_video_teams`       |        4,096 |         4,096 |
| `film_room_videos`            |       86,016 |        16,384 |
| `ingestion_jobs`              |      532,480 |         4,096 |
| `nfl_teams`                   |        4,096 |         4,096 |
| `observer_run_events`         |        4,096 |         4,096 |
| `observer_run_items`          |        4,096 |         4,096 |
| `public_schedule`             |        4,096 |         4,096 |
| `source_check_daily`          |        4,096 |         4,096 |
| `source_checkpoints`          |        4,096 |         4,096 |
| `source_checks`               |      208,896 |         4,096 |
| `source_teams`                |        4,096 |         4,096 |
| `sqlite_schema`               |       28,672 |        28,672 |
| `story_domain_events`         |       12,288 |        12,288 |
| `story_editorial_overrides`   |        4,096 |         4,096 |
| `story_entities`              |        4,096 |         4,096 |
| `story_evidence`              |       16,384 |        16,384 |
| `story_publication_decisions` |        4,096 |         4,096 |
| `story_versions`              |       90,112 |        90,112 |
| `three_and_out_snapshots`     |      368,640 |        12,288 |
| `transaction_assertions`      |        4,096 |         4,096 |
| `video_source_registry`       |        4,096 |         4,096 |

Every SQL index, including automatic unique indexes:

| Index                                            | Inline bytes | Compact bytes |
| ------------------------------------------------ | -----------: | ------------: |
| `candidate_teams_team`                           |        4,096 |         4,096 |
| `candidates_fingerprint`                         |       12,288 |        12,288 |
| `candidates_source_time`                         |       12,288 |        12,288 |
| `checks_archive_ready`                           |       32,768 |         4,096 |
| `checks_source_time`                             |       40,960 |         4,096 |
| `edition_team_date`                              |        4,096 |         4,096 |
| `editions_archive`                               |        4,096 |         4,096 |
| `editions_published`                             |        4,096 |         4,096 |
| `evidence_candidate`                             |        4,096 |         4,096 |
| `evidence_story`                                 |        4,096 |         4,096 |
| `jobs_archive_ready`                             |       61,440 |         4,096 |
| `jobs_claim`                                     |       61,440 |         4,096 |
| `jobs_due`                                       |       61,440 |         4,096 |
| `jobs_exhausted`                                 |        4,096 |         4,096 |
| `jobs_leases`                                    |       24,576 |         4,096 |
| `jobs_reclaim`                                   |       49,152 |         4,096 |
| `outbox_due`                                     |        4,096 |         4,096 |
| `overrides_active`                               |        4,096 |         4,096 |
| `run_log_time`                                   |        4,096 |         4,096 |
| `source_teams_team`                              |        4,096 |         4,096 |
| `sources_due`                                    |        4,096 |         4,096 |
| `sources_national`                               |        4,096 |         4,096 |
| `sqlite_autoindex_archive_records_2`             |        4,096 |        90,112 |
| `sqlite_autoindex_candidate_teams_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_canonical_stories_1`           |        4,096 |         4,096 |
| `sqlite_autoindex_content_candidate_revisions_1` |        4,096 |         4,096 |
| `sqlite_autoindex_content_candidates_1`          |        4,096 |         4,096 |
| `sqlite_autoindex_content_candidates_2`          |       12,288 |        12,288 |
| `sqlite_autoindex_content_candidates_3`          |       12,288 |        12,288 |
| `sqlite_autoindex_content_candidates_4`          |       16,384 |        16,384 |
| `sqlite_autoindex_content_control_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_content_outbox_1`              |        4,096 |         4,096 |
| `sqlite_autoindex_content_outbox_2`              |        4,096 |         4,096 |
| `sqlite_autoindex_content_run_log_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_content_sources_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_editorial_cards_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_editorial_cards_2`             |        4,096 |         4,096 |
| `sqlite_autoindex_film_room_video_teams_1`       |        4,096 |         4,096 |
| `sqlite_autoindex_film_room_videos_1`            |        4,096 |         4,096 |
| `sqlite_autoindex_ingestion_jobs_1`              |       36,864 |         4,096 |
| `sqlite_autoindex_ingestion_jobs_2`              |       32,768 |         4,096 |
| `sqlite_autoindex_nfl_teams_1`                   |        4,096 |         4,096 |
| `sqlite_autoindex_nfl_teams_2`                   |        4,096 |         4,096 |
| `sqlite_autoindex_observer_run_events_1`         |        4,096 |         4,096 |
| `sqlite_autoindex_observer_run_items_1`          |        4,096 |         4,096 |
| `sqlite_autoindex_public_schedule_1`             |        4,096 |         4,096 |
| `sqlite_autoindex_source_checkpoints_1`          |        4,096 |         4,096 |
| `sqlite_autoindex_source_checks_1`               |       24,576 |         4,096 |
| `sqlite_autoindex_source_teams_1`                |        4,096 |         4,096 |
| `sqlite_autoindex_story_domain_events_1`         |        4,096 |         4,096 |
| `sqlite_autoindex_story_domain_events_2`         |        4,096 |         4,096 |
| `sqlite_autoindex_story_editorial_overrides_1`   |        4,096 |         4,096 |
| `sqlite_autoindex_story_entities_1`              |        4,096 |         4,096 |
| `sqlite_autoindex_story_evidence_1`              |        4,096 |         4,096 |
| `sqlite_autoindex_story_evidence_2`              |        4,096 |         4,096 |
| `sqlite_autoindex_story_publication_decisions_1` |        4,096 |         4,096 |
| `sqlite_autoindex_story_publication_decisions_2` |        4,096 |         4,096 |
| `sqlite_autoindex_story_versions_1`              |        4,096 |         4,096 |
| `sqlite_autoindex_story_versions_2`              |        4,096 |         4,096 |
| `sqlite_autoindex_three_and_out_snapshots_1`     |        4,096 |         4,096 |
| `sqlite_autoindex_transaction_assertions_1`      |        4,096 |         4,096 |
| `sqlite_autoindex_video_source_registry_1`       |        4,096 |         4,096 |
| `sqlite_autoindex_video_source_registry_2`       |        4,096 |         4,096 |
| `stories_feed`                                   |        4,096 |         4,096 |
| `stories_first_report`                           |        4,096 |         4,096 |
| `stories_importance`                             |        4,096 |         4,096 |
| `stories_team_page`                              |        4,096 |         4,096 |
| `story_entities_story`                           |        4,096 |         4,096 |
| `video_teams_video`                              |        4,096 |         4,096 |
| `videos_available_time`                          |        4,096 |         4,096 |
| `videos_published`                               |        4,096 |         4,096 |

Candidate latest records and revisions each held a full article before optimization; matching immutable text is now stored once. Retained root JSON, scalar lookup fields, archive ID receipts and indexes still cost bytes. The shared blob allocation includes both compressed data and its physical fragmentation overhead. Local raw byte totals: `{"chunks": 1142, "uncompressedBytes": 4018873, "storedBytes": 253007}` (fragment bodies are measured by the physical table audit, not this parent-only body sum).

Shared payload tables cannot be assigned entirely to any one editorial table: the same bytes may back candidate text, multiple historical revisions and operational packs. The measured shared allocation is reported explicitly rather than double-counted as savings in each table.

## Growth model

`measurements/storage-projection.json` and `scripts/storage-project.ts` extrapolate measured retained pages. Fixed schema/source/checkpoint/control pages and one root per growing object are allocated once. Remaining owned pages represent one daily cohort. The model adds 15% for density/fragmentation changes, preserves the original POC allocation, and reserves 2 MB scratch. It assumes continued explicit successful compaction of eligible operational records; no compactor is scheduled here. All daily cohorts remain retrievable forever. The sample contains 33 sources rather than the previous 163; constant source metadata does not establish per-source historical growth.

New stories and videos are conservatively treated as retained new records every day. A full annual multi-day database was not populated: these are projections from one full day, not measured 365-day file sizes. Long-lived B-trees, failed-write orphans, larger evidence inventories, permanently unacknowledged outbox entries, migrations and delayed compaction can increase growth beyond these assumptions. Cache hits reduce reads, never stored history.

| Mode (MB, decimal) | 30 days | 90 days | 180 days | 365 days |
| ------------------ | ------: | ------: | -------: | -------: |
| inline             |  222.19 |  628.89 | 1,238.93 | 2,492.91 |
| compact            |   82.29 |  209.19 |   399.54 |   790.81 |
| entropy            |  132.32 |  359.26 |   699.68 | 1,399.44 |
| large-versions     |  127.79 |  345.70 |   672.55 | 1,344.42 |

## Architecture comparison

All storage values are MB; only A is based directly on the implemented placement.

| Architecture                      |       30 days |        90 days |        180 days |        365 days |
| --------------------------------- | ------------: | -------------: | --------------: | --------------: |
| A: single D1                      |         82.29 |         209.19 |          399.54 |          790.81 |
| B: three D1 total (largest shard) | 95.52 (38.21) | 235.11 (94.04) | 444.49 (177.80) | 874.89 (349.95) |
| C: D1 / R2                        |  82.29 / 0.00 | 126.71 / 82.48 | 193.33 / 206.21 | 330.27 / 460.53 |
| D: PostgreSQL planning range      |  82.29–333.29 |  209.19–943.33 | 399.54–1,858.40 | 790.81–3,739.36 |

| Architecture | Daily reads / writes estimate                                                                             | CPU                                                | Complexity / feasibility                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A            | 559,250 / 92,512                                                                                          | Unqualified; hashing/compression and unpacking     | Lowest complexity; **365-day storage fails**                                                                                     |
| B            | 671,100 / 101,763 across the account                                                                      | Unqualified; coordination adds work                | High; assumed storage split fits per-DB/account limits at base workload, but assumed write overhead exceeds 100k/day             |
| C            | Conservatively 559,250 / 92,512, plus object operations                                                   | Unqualified; archive hashing/restoration adds work | High; assumed base storage fits published allowances, needs archive/restore implementation, invocation budget and account review |
| D            | Same logical workload, ~2,000 origin public queries/day plus ingest; physical reads/WAL writes unmeasured | Worker and PostgreSQL CPU both unqualified         | Medium/high; upper storage estimate exceeds example free host allowance; sustained activity may exceed free compute              |

A is implemented locally. B assumes 10% duplication/index overhead plus 5 MB and a 30% editorial / 40% history / 30% operations allocation. These percentages are planning assumptions, not measurements of a completed split; shared blobs and source catalogs need deliberate placement. Separate D1 databases lose cross-database foreign keys and atomic publication/job moves. Stable routing, reconciliation, snapshot/export tooling and failure tests would be required. There is no per-team database proposal.

C assumes 35% of bytes must remain permanently indexed in D1 and 65% can move losslessly to Standard R2 after 30 days. The D1 estimate includes that 30-day hot window; an ID/attribution directory must remain in the hot share. Neither ratio is validated by an implemented object archive. Plan approximately 250 packed PUTs/day (7,500/month), up to 1,000 historical GETs/day (30,000/month), and compare the projected cold object bytes with the account's remaining allowance. Immutable checksummed manifests, restore verification and a two-phase archive/outbox protocol are required before removing a redundant D1 copy. R2 is optional and was not provisioned.

D's range uses optimized SQLite as a lower planning bound and inline SQLite ×1.5 as an upper bound, not a measured PostgreSQL/TOAST size. Cache 90% of 20,000 daily public requests: about 2,000 origin requests remain. PostgreSQL has no equivalent D1 per-row billing model; the same logical ingest workload applies, but physical index/WAL amplification, compute and egress are unmeasured. Caching cannot shrink retained data. Frequent checks can prevent a free hosted database from sleeping.

## Performance and amplification

| Measured full day | Statements | Rows read | Rows written |
| ----------------- | ---------: | --------: | -----------: |
| inline            |     20,594 |    30,906 |       54,524 |
| compact           |     35,146 |    46,888 |       73,497 |
| entropy           |     37,303 |    47,803 |       75,622 |
| large-versions    |     40,811 |    51,294 |       75,555 |

Compact versus inline local amplification: **1.52× rows read**, **1.35× rows written**, **1.71× statements**. Includes archive moves and their indexes. Baseline and optimized writer safety checks are identical. Diagnostic count/size SQL and the raw benchmark outbox acknowledgement update are excluded from these wrapper totals; the model adds 512 bridge/ack operations and 25% reserve. The estimate is not exact production billing.

Selected compact operation means (local Node CPU excludes workerd CPU):

| Operation      | Statements | Rows read | Rows written | Wall ms | Node CPU ms |
| -------------- | ---------: | --------: | -----------: | ------: | ----------: |
| candidate      |      21.25 |      5.00 |        30.25 |   28.54 |       13.83 |
| revision       |      22.05 |     24.05 |        22.05 |   34.88 |       19.77 |
| story          |       3.00 |      0.00 |        12.00 |    3.14 |        1.97 |
| evidence       |       4.00 |      3.00 |         8.00 |    4.78 |        2.84 |
| publish        |      10.00 |      5.88 |        28.00 |    9.71 |        5.97 |
| video          |       8.00 |      0.00 |        12.00 |   10.98 |        5.44 |
| edition        |      22.00 |     11.00 |        22.00 |   30.69 |       14.01 |
| check          |       5.00 |      5.97 |        10.03 |    5.11 |        2.03 |
| enqueue        |       4.00 |      4.00 |        11.00 |    5.21 |        2.05 |
| complete       |       3.00 |      4.00 |         9.00 |    3.37 |        1.26 |
| compact.job    |      41.55 |     67.28 |        73.17 |   38.23 |       16.43 |
| compact.check  |      53.22 |     50.25 |        84.70 |   44.75 |       19.64 |
| compact.outbox |     108.91 |    216.64 |        92.09 |  152.72 |       67.68 |
| read.feed      |       1.00 |      7.47 |         0.00 |    1.88 |        0.87 |
| read.history   |       6.00 |     10.35 |         0.00 |   10.89 |        4.46 |

Daily qualification adds 300,000 assumed origin rows (20k public requests ×10% misses ×150 rows), 100,000 clustering rows (200×500), 512 bridge/ack rows and a 25% retry reserve: **559,250 reads and 92,512 writes/day**. Writes remain below the published limit in the base model but exceed the 70k/day operating target; headroom is limited. Requests, clustering and cache ratios are assumptions; no production pipeline or cache is implemented.

**Current compaction is not Free-invocation qualified.** Measured check and outbox pack operations can exceed 50 total statements even though each individual batch stays bounded. They need smaller packs or resumable work before use in one Free invocation. Compression, hashing and historical expansion have not been measured against Cloudflare CPU limits. No local timing can certify the 10 ms allowance.

## Published free allowances, checked 2026-10-16

Published limits were checked, **not the user's live account utilization or entitlement**. Other applications share these allowances. There was no authenticated account query.

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free allows 10 databases, 500 MB each, 5 GB total per account, 50 queries per invocation, 100 bound parameters, and 2 MB rows. Splitting databases cannot create unlimited storage or independent daily row budgets.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): 5 million rows read and 100,000 rows written per day; index updates contribute to writes. DDL also has costs.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): 100,000 requests/day per Free account and 10 ms CPU per HTTP request or Cron invocation. Local Node CPU and workerd wall time do not establish deployed CPU compliance.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard free allowance is 10 GB-month storage, 1 million Class A and 10 million Class B operations/month, shared with other usage. Infrequent Access has no such free allowance. Billable overages mean an optional R2 design needs account/billing controls before any deployment; it is not an unconditional zero-cost promise.
- [Neon pricing](https://neon.com/pricing): the published Free example currently includes 1 GB storage and 100 CU-hours/month per project, with 5 GB public transfer. At 0.25 CU, continuous operation for 730 hours is about 182.5 CU-hours/month, above that compute allowance. Existing Front Office/account capacity was not inspected or assumed available.

## Validation and remaining risks

31 TypeScript/Miniflare tests pass, including the original 22. Added coverage verifies reserved-key/Unicode/BOM roundtrips, chunk reuse, corruption/missing fragments, candidate and story history, pinned attribution, saved identity after restart, forward migration from 0001–0003, exact hot/cold field parity, check aggregates, cold-ID replay protection, stale leases, and transaction failure with no partial archive directory. Two independent Python SQLite page-audit tests pass, including an uncheckpointed WAL fixture. Typecheck, Worker dry-run build, formatting and whitespace checks pass. No Android/iOS or web UI validation is applicable because no product screen changed.

Remaining limitations: new evidence pins cannot repair unknown old mappings; one existing candidate/evidence pair cannot yet attach multiple later revisions as separate evidence rows; source catalog names remain mutable while original candidate metadata remains retained. SQL constraints cannot follow JSON reference graphs, so checksums and retrieval validation are essential. Immutable failed-write blobs are not automatically collected. Fully searching cold JSON requires a separate search/index strategy. Large records, deep JSON, unpacking a history pack and repeated digest/compression work can exceed a Free invocation's query or CPU budget; batch-size checks alone do not certify an overall invocation. Cold packs are bounded to 12 records, but callers must lower that limit or split work further if total statements exceed their invocation budget. No production route currently executes any of these operations.

## Recommended next steps

Keep this work local for review. Prefer a separately scoped D1 + optional R2 archive proof if strict $0 launch remains the objective; validate the hot fraction and roundtrip/restoration protocol before adopting it. Alternatively prototype actual editorial/history/operations partitions and measure their shared daily writes and largest shard. Neither alternative is approved for migration by this report.

Use a representative, authorized sample to measure compression and attribution parity, then populate a larger multi-day synthetic database to test B-tree density and compaction lag. Add end-to-end per-invocation query/CPU budgeting, observe deployed Free behavior only in a separately approved experiment, and check actual remaining account allowances before making a launch claim. Keep saved IDs stable and require integrity/restore reconciliation before any future migration.

## Files

New: migrations 0004–0006; `src/payloads.ts`, `src/archive.ts`, `src/repack.ts`; `scripts/sqlite-pages.py`, `scripts/storage-benchmark.ts`, `scripts/storage-project.ts`; `test/storage.test.ts`, `test/sqlite-pages-test.py`; `measurements/storage-benchmark.json`, `measurements/storage-projection.json`; this report.

Updated only within this package: `src/database.ts`, `src/repository.ts`, `src/jobs.ts`, `test/harness.ts`, `package.json`, `README.md`, `.gitignore`. No shared root documentation or application file changed.
