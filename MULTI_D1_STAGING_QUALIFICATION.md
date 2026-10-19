# Multi-D1 staging qualification

2026-10-19. Baseline `poc/durable-batched-polling`, `c8d80820`. Isolated implementation branch `poc/multi-d1-staging-qualification`, worktree `/private/tmp/down-distance-staging-preparation`.

**Feasibility: FAIL. Ready for staging: NO. Ready for production: NO.** The batched-polling write improvement remains valid for its measured workload. It does not resolve retained editorial storage or qualify four-version daily editorial demand. The conditional routing gate stays closed: no multi-D1 routing, remote resources, deployment, paid services, R2, PostgreSQL, production access, data deletion, or automatic team migration was introduced.

## Required result fields

| Field | Result |
|---|---|
| Architecture | Proposed 8 team-content + 1 centralized user + 1 shared-system D1; not enabled |
| Database allocation | 184 current tables classified; 28 declared cross-role FK edges; see table allocation artifact |
| Storage per database, 50 DAU/365 days | Base about 129 MB/team, 63.7 MB USER, 224.8 MB SHARED; retained changed-body sensitivity about **470 MB/team** |
| Total storage | About **1.32 GB base / 4.05 GB retained sensitivity**, including reserve |
| D1 reads/day | **774,999** at 50 DAU in the measured first-day single-D1 workload plus assumed user activity; mature maintenance and multi-D1 additions unqualified |
| D1 writes/day | **68,714** for that workload; **74,668** four-version steady-state sensitivity, before shard coordination |
| Maximum queries | **47** in baseline bounded ingestion; current browser HTTP counts reported separately; no multi-D1 invocation measurement |
| Cross-database integrity | Designed only; SQL cross-role constraints cannot be assumed to work across databases |
| Scheduler | Existing single-D1 durable protocol retained/tested; 18,504-check baseline reused; no claim of shard compatibility |
| Recovery | Single-D1 recovery regressions plus complete evidence copy/restore pass; no ten-database restore qualification |
| Tests passed / failed | **1,225 automated + 7 model checks + 48 browser routes passed; 0 failures; 2 existing skips** |
| Remaining blockers | Retained-reference storage, matched history writes, provenance gaps, unimplemented cross-shard integrity, mature maintenance, hosted CPU |
| Ready for staging / production | **NO / NO** |

## What changed and what was measured

Added a reproducible capacity gate using the latest complete-day polling counters, current canonical history representation, approved retention assumptions, and all requested DAU/horizon combinations. New local D1 fixtures commit four real canonical versions, verify every historical reconstruction and source attribution, and traverse the canonical object graph to sum actual encoded payload bytes.

Two 12 KB high-entropy prose cases are measured: unchanged prose shared across corrections, and four independent correction bodies. The former is about 13.7 KB/article; the latter about 41.3 KB/article. Exact run values and object counts are in `reports/multi-d1-staging/canonical-sizes.json`. These are actual current adapter/D1 measurements, not production content-size observations. Four changed bodies are a supported preservation case, not an assertion that every real correction completely replaces its text.

The old canonical proxy was roughly 62.7 KB/article. Current sharing helps significantly, but a headline-only correction benchmark cannot be applied to all distinct historical bodies. The 50-DAU annual all-reference model with unchanged bodies is about 325 MB/team; changing bodies moves it to about 470 MB/team. Claiming success from the former would omit the explicit retained-reference sensitivity.

No body/revision, saved article, source evidence, betting board, identifier, or relationship was removed to improve these results. No production API behavior was changed. The only storage-library addition is an opt-in owner-side complete saved-evidence preparation function; it is not wired into user saves, cleanup, or any board-release path.

## Capacity and storage projections

All **16 combinations** of 0/25/50/100 DAU and 30/90/180/365 days are in [projections.md](reports/multi-d1-staging/projections.md), with all ten DB sizes in `capacity.json`. The model retains:

- Approved published/candidate/briefing/odds retention windows and permanent reference exceptions.
- Original article/correction bodies, source evidence, public projections, FTS/directories/indexes, historical odds, saved evidence, user/authentication/Front Office data.
- Operational history, candidate identity receipts, audit plans, and a 20% physical reserve.
- Ten conservative full schema/registry copies, plus the measured 12,288-byte migration-0045 initial page delta per copy. No cross-database object-deduplication credit.
- Owner-managed offline backups rather than duplicate D1 backup databases. The unchanged policy of retaining two copies of every daily full snapshot projects roughly **1.49 TB owner disk** for the annual retained-reference case. This is a planning proxy based on modeled database bytes, not a measured compressed/export format size. It is not Cloud storage or an approved backup rotation improvement.

The previous operational-history proxy does not identify poll-job-only bytes. Removing its entire 116.9 MB annual component merely because poll jobs disappeared would be unsupported. That component is conservatively retained; the measured removal of completed polling jobs is established by the separate one-day physical benchmark, not subtracted twice from an unrelated annual proxy.

At 50 DAU/year, even granting a counterfactual that removes **all older odds AND Lab Score payloads, including all saved-board costs**, the retained changed-body team shard remains about **423 MB**. This is more favorable than any complete evidence implementation could justify and still fails 350 MB. No such deletion or savings was implemented or credited.

At least one of eight team shards must hold at least the team-data average. The changed-body retained case averages about 470 MB/shard, so no reassignment of teams among those eight shards can make every one smaller than 350 MB. The account also exceeds 3.5 GB regardless of reassignment. Uniform annual projections may remain under the hard 500 MB/5 GB caps while failing the requested operating targets; that is not staging qualification. Seasonal skew can exceed even the hard per-database envelope.

Other encoded/structured domain sizes remain approved synthetic proxies, clearly labeled in the artifacts. This is not a physical ten-database measurement. The unchanged **64 MB encoded-payload admission guard** can bind earlier than the modeled physical limit; it was not raised speculatively. Mature full export/GC/retention scan reads are not qualified by a small first-day benchmark and remain additional unknown demand.

## Allocation and seasonal distribution

The deterministic divisional four-team allocation is the simplest uniform-load design:

| DB | Proposed team/content ownership |
|---|---|
| TEAM_1 | ARI LAR SF SEA |
| TEAM_2 | ATL CAR NO TB |
| TEAM_3 | BAL CIN CLE PIT |
| TEAM_4 | BUF MIA NE NYJ |
| TEAM_5 | CHI DET GB MIN |
| TEAM_6 | DAL NYG PHI WAS |
| TEAM_7 | DEN KC LAC LV |
| TEAM_8 | HOU IND JAX TEN |
| USER | Accounts, credentials, sessions, preferences, Front Office, saved content/bets and permanent user/application state |
| SHARED | NFL/system reference data and source definitions/checkpoints; the global polling lease and pending/retry inboxes |

[table-allocation.md](reports/multi-d1-staging/table-allocation.md) classifies every current table, including FTS shadows and rollback tables. Local payload/epoch/GC infrastructure belongs separately in each populated database; polling tables are specifically shared, not eight independent copies of the same global scheduler. Existing source-to-candidate/evidence relationships account for some of the 28 cross-role SQL FK edges. The inventory is a proposed ownership map, not deployed role-specific DDL.

Four mapping strategies were re-evaluated against the prior explicitly synthetic skew: four teams have three times ordinary volume. Named teams in that fixture are not evidence of their actual NFL audience/ingestion volume. With the same total team bytes redistributed, the annual retained maximum is approximately:

| Strategy | Max modeled DB |
|---|---:|
| Equal four-team divisional groups | 1,123 MB |
| Uneven team counts | 657 MB |
| Capacity-aware deterministic static bins | **470 MB** |
| Dedicated high-volume team shards | 657 MB |

The capacity-aware bins balance the synthetic weights exactly, achieving the average lower bound. They still fail the operating target. Their exact team membership is in `capacity.json`; they are not a recommended production migration without observed team-specific volumes. A separate stress adds 25% aggregate editorial demand rather than merely redistributing a fixed total: even the balanced mapping reaches roughly **571 MB**, including reserve. No automatic online movement was implemented.

## Daily operations and query headroom

Latest measured single-D1 workload plus observed HTTP user-unit costs and explicit frequency assumptions:

| DAU | Reads/day | Writes/day | Worker requests/day including proposed trigger invocations | Four-version steady-state writes sensitivity |
|---:|---:|---:|---:|---:|
| 0 | 767,714 | 64,664 | 12,815 | 70,618 |
| 25 | 771,357 | 66,689 | 13,260 | 72,643 |
| 50 | 774,999 | 68,714 | 13,705 | **74,668** |
| 100 | 782,284 | 72,764 | 14,595 | 78,718 |

The first four operation columns reuse the baseline **complete synthetic 24-hour workload**, not isolated adapter calls. That workload includes two versions per article: 96 original articles and 96 corrections. The four-version storage proxy requires three corrections per article over time; a matched steady state adds 192 daily corrections. Charging their actual full-day unit cost (2,977 writes/96 corrections) adds 5,954 writes/day. This is a labeled sensitivity calculation, not a newly replayed seasonal production day. It exposes the mismatch instead of assuming the 68,714 figure includes every modeled history growth pattern.

These counters include maintenance guard/index writes, retention cleanup and daily recovery preparation. The DAU frequency mix is not a census of Huddle, trivia, commerce, media, or every product workflow; notification fanout was suppressed by observer mode in the measured day. Those demands are not made free by this model. They are account-wide single-D1 measurements plus DAU assumptions, **not certified ten-D1 totals**. Ten DBs do not multiply daily allowances. Future durable handoff receipts, ownership directories/pins, global search fanout, source-definition copies, extra per-DB maintenance/fences, and recovery coordination remain additional unmeasured operations. The ordinary 50-DAU planning target leaves only 1,286 writes before those additions; the matched four-version sensitivity already exceeds 70,000 before them.

The existing 47-query peak is cold publication plus automation accounting. Corrections remain 28; some new-feed inbox batches reach 34; odds publication reaches 36. These are individually counted SQL statements, including batch members and fences. The baseline API's shared 50-query guard remains unchanged. Under-30 is not achieved for every path and multi-database operations cannot be counted as one query. New evidence preparation is owner-only and can load a whole board; it is not presented as a qualified bounded Worker HTTP endpoint.

Current browser HTTP metrics cover authentication, saved content, Front Office and Parlay workflows: **1,057 samples, maximum 38 statements, zero at/above 50**, scoped to single-D1 browser traffic. Large-history/cross-database query counts remain unmeasured because routing was not enabled. No speculative query or write savings were credited. The full 24-hour baseline was not rerun merely to change an unused owner helper; its scope is preserved in this report.

[Current official D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) confirm the shared 5-million-read/100,000-write daily allowance and Free storage/query constraints. No existing account consumption or availability was inferred from published limits. Local elapsed time and local workerd success do not establish hosted Worker CPU compliance.

## Complete saved-betting evidence contract

The existing preparation experiment selected by market ID alone. Real provider rows may reuse that ID across books, while legacy saved metadata is arbitrary JSON. Additionally, `D1OddsBoard.publishProvider` currently projects away some original provider market/selection identifiers; its board envelope does not freeze provider identity. These omissions cannot be reconstructed safely by guessing from the latest event.

The new `prepareCompleteSavedOddsEvidence` requires a frozen, SHA-verified board with matching original event ID, provider event ID, source identity, and capture timestamp. Each selection must match exactly one original row by market ID, player ID, sportsbook, selection, line, and odds. Original provider market/player/selection IDs are mandatory and verified too. Every selected source row is retained in full, including unknown provider fields. It supports the same market ID at different explicitly identified sportsbooks, rejects duplicate/ambiguous selections, and refuses legacy missing provenance.

The resulting immutable record contains all required evidence and can be read after copying it to an otherwise empty synthetic D1 without loading the original board. Tests verify exact restoration, changed price/player/book/provider/timestamp rejection, and unchanged original board contents. The source `boardHash` remains retained and **`boardReleaseAuthorized` is always false**. No saved record, board pin, retention policy, or GC rule was changed.

This completes the opt-in preparation contract for demonstrably complete inputs, not a migration of all existing saved bets. Prospective ingestion must freeze the missing original IDs/provenance, and real saved selections need a durable verification/migration receipt plus validated restore and retention integration before any board could be released. Since the most optimistic extraction counterfactual still fails capacity, wiring a risky release mechanism would not open this gate.

## Scheduler, cross-database integrity, and recovery

The shared coordinator can conceptually retain all 97 RSS sources and original intervals (18,504 checks/day) without creating ten independent schedulers. Candidate processing would route to the canonical team/event owner only after a durable destination receipt; the shared inbox/checkpoint cannot advance solely because an HTTP call was sent. A retry must deduplicate by source/external identity and content receipt. No transaction spanning databases can be assumed. These are integration requirements, not implemented or measured multi-D1 behavior.

Existing single-D1 tests cover leases, actual persisted workerd restart, source timeout, partial completion, duplicate scheduling, interrupted candidate enqueue, original attribution, and concurrent publication. New tests inject a D1 daily-quota exception at the checkpoint transaction: source checkpoints and the lease stay intact, then retry completes without a lost checkpoint. This models failure semantics; it does not reproduce Cloudflare's actual account reset timing. Production Cron Triggers remain disabled. The Mon/Wed/Sat odds schedule remains unchanged.

Authentication and permanent user records must remain centralized. Saved article/event IDs need a durable ownership directory and cross-shard reference pins. Team changes alter central preferences, not historical ownership. Global search requires bounded, complete fanout with per-shard cursors and one request-wide budget; incomplete results cannot silently masquerade as a full search. Existing single-D1 rollback support is untouched.

Single-D1 recovery and original IDs/relationships are covered by existing regressions; the new complete evidence record is independently copied/restored in a second local D1. Ten-database consistent backup/restore, cross-team search, team switching across real shard bindings, and sharded scheduler recovery were **not run**: implementing them would violate the failed capacity gate. Time Travel alone is not an atomic ten-database application backup.

## Validation and next action

**Tests passed: 1,225 unique automated tests (1,074 application + 151 Worker), seven Python model checks, and 48 browser routes. Tests failed: 0; existing skips: 2.** The eight focused polling/evidence/quota cases and final two provenance/legacy cases also passed; those overlap the full suite and are not added to the unique automated count. The latter rerun verifies the final stricter provider-ID and same-market/multi-book review changes. Completion results are recorded in `reports/multi-d1-staging/validation/` and the copied regression logs. The full application and Worker regression suites, critical browser routes, Python model invariants, complete evidence tests, and quota/restart/polling tests were run. Focused reruns overlap the full suite and are not counted as extra unique tests. Old milestone evidence is preserved unchanged; new generated evidence lives under this mission's report directory.

No web/native UI changed. Browser validation is local Chromium desktop and responsive mobile-web for KC and SEA; it is not Android/iOS device validation. No production account, live provider, remote D1, R2, billing setting, deployment, or DNS was accessed.

**Recommended next action:** keep routing closed. Close the retained changed-body storage gap (roughly 120 MB per team shard at one year) without discarding required history, and qualify the matched correction workload and mature maintenance within account quotas. Provenance-preserving future boards can support a later verified saved-evidence migration, but extraction alone is insufficient. Any revised data admission/retention or infrastructure constraints require an explicit product decision; no such change was made here. Hosted CPU and real account headroom would still need qualification afterward.

Rollback is a local revert of this isolated commit: the new helper is opt-in, no migration or runtime storage binding changed, no board was unpinned, and no user/editorial data moved. No deployment command is recommended while the gate is closed.

Reproduce with existing local dependencies and DATABASE_URL absent:

```sh
# From workers/content-engine, using synthetic local workerd:
AUTH_JWT_SECRET=synthetic-worker-test-key-at-least-32-characters TSX_TSCONFIG_PATH=../../tsconfig.test.json node --import tsx --test test-node/multi-d1-staging-capacity.test.ts test-node/complete-saved-evidence.test.ts test-node/polling-batches.test.ts
# From repository root:
python3 scripts/project-multi-d1-staging.py
python3 scripts/test-multi-d1-staging.py
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
```
