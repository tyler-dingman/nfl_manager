# Down & Distance — Zero-Cost Production Readiness, Phase 4

## 1. Executive summary

**Production readiness: BLOCKED. Phase 4 is partially implemented; whole-product D1 completion and $0 at 1,000 DAU are not achieved.** Storage safety, recovery scale, daily trivia/rewards, compact odds history and supported framework compatibility have concrete implementations. No production-readiness claim follows from passing local tests.

Worktree `/private/tmp/down-distance-zero-cost-phase-4`, branch `poc/zero-cost-production-readiness-phase-4`, base `8adafd53`. No production access, deployment, paid activation, real provider calls or existing user-data deletion. PostgreSQL remains the default and rollback implementation. All binding mutations use synthetic local data.

## 2. Architecture changes

One staged D1 + private R2 remains the simplest local candidate. PostgreSQL remains authoritative/default with rollback retained. Additive migrations 0016–0018 add bounded lifecycle indexes, history/settings, daily trivia/reward relationships and odds history. Original IDs/raw imports remain. SHA-addressed gzip objects and shared trees preserve old reads. Maintenance/cache/provider flags remain disabled. No user/game/editorial body garbage collector is enabled.

## 3. Storage optimization results

Game fixture full logical snapshots 25,875,892 bytes → 309,402 primary physical bytes (1.20%). All versions remain. This does not justify applying that ratio to every dataset. D1 forecast remains about 927.17 MB with derived-key maintenance, above target. Backup compression and unchanged-checkpoint reuse work, but changed-data retention/reuse remain unqualified. See PHASE_4_STORAGE_OPTIMIZATION.md for every requested dataset and exact page evidence.

## 4. D1 integration status

Daily trivia GET/POST now operate against D1, preserving point values and atomic answer/stats/yard/unlock behavior. Standalone Move the Chains awards use D1 with idempotency and version guards. New typed imports preserve original daily/reward IDs and foreign keys. Settings CAS and compact odds history are implemented. Full multiplayer trivia, reward dashboard/claim/redemption, Front Office and Parlay application paths remain incomplete. See PHASE_4_D1_INTEGRATION.md.

## 5. PostgreSQL dependency status

Default connections were not changed. The original trivia repository is retained. Full PostgreSQL Front Office/auth/transfer/trade regression tests execute. The 50-table synthetic import archives 34 rows and maps 29 typed rows, with exact raw records for unported data. It is not full application migration. Existing polling is not disabled; verified PostgreSQL compute removed: 0. Full migration replay still stops at unavailable local pgvector, documented in full-postgres-migrations.json.

## 6. Cloudflare runtime compatibility

Pinned Next 15.5.28/OpenNext 1.20.12 builds and boots under actual local workerd with Node compatibility. Promise-based route parameters preserve existing URLs. Existing-session, saved-content, SSR and lexical-search probes run; unavailable endpoints remain explicit. Minified artifact **3204.78 KiB gzip exceeds Workers Free's 3 MiB**. Worker password auth remains unavailable; Node rollback retains original Argon2 strength. Compatibility improved; Free hosting is not qualified.

## 7. Worker performance results

Local wall timings and D1/R2 metadata are recorded; production CPU remains **UNVERIFIED**. Public cache and batching/indices/paging are implemented, with cache disabled and no speculative hit-rate credit. Game sharing adds object operations; the model includes them. Backup/restore is offline multi-batch tooling, not a qualified single Free Worker invocation. See PHASE_4_PERFORMANCE.md.

## 8. Parlay Lab optimization

The same three weekly odds windows remain disabled. New history uses shared compressed subtrees, compact timestamp indexes and explicit schema-2 references, retaining legacy raw reads. All provider fields/books/alt lines/as-of values remain. Board IDs, Lab Score/Trending Props precompute, grading and complete transfer integration remain PostgreSQL. Historical data is not represented as live.

## 9. Recovery scale testing

3,000 users, 3,000 saved bets, 401 game versions, 74 tables, 15,535 rows and 1,603 objects survive failure/interruption/idempotent recovery. Full local backup 16.13 s; resumed restore 21.28 s. Duplicate checkpoint has identical ID and zero new writes. Off-account, streaming/annual population and cutover qualification remain incomplete. See PHASE_4_RECOVERY_SCALE_TEST.md.

## 10. Provider integration status

Mock/contract behavior and disabled scheduler dry-runs pass. No real AI/email/sports/partner execution occurred. Exact external validation steps are documented in PHASE_4_PROVIDER_VALIDATION.md. Credential-free local validation cannot certify provider rights, account allowance, delivery or inference quality.

## 11. Test results

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| unit-tests.log | 1059 | 0 | 2 |
| d1-all-tests.log | 96 | 0 | 0 |
| front-office-integration.log | 21 | 0 | 0 |
| auth-durability-integration.log | 2 | 0 | 0 |
| sportsbook-db-integration.log | 1 | 0 | 0 |
| trade-http-integration.log | 1 | 0 | 0 |
| SQLite pages | 2 | 0 | 0 |

Total successful suite checks: **1,182**, failures: **0**. Browser: 48 route/viewport cases, no errors/overflow. Two standalone conditional skips execute and pass in dedicated sportsbook/trade integrations; no tests were removed. New Worker runtime tests exercise actual workerd compression; D1 API tests separately exercise daily trivia and ownership. Original 53 archival tests remain within the complete D1 suite. Typechecks and Node/Worker builds are retained separately. Native devices/simulators remain unverified; rendering adapters were not redesigned.

## 12. Updated storage projections

| Days | D1 MB | R2 GB, all daily checkpoints | R2 GB, hypothetical eight directories | Worst-game R2 GB |
|---|---:|---:|---:|---:|
| 30 | 198.97 | 1.64 | 0.79 | 3.65 |
| 90 | 329.39 | 6.27 | 1.70 | 12.30 |
| 180 | 525.03 | 16.88 | 3.06 | 28.94 |
| 365 | 927.17 | 52.51 | 5.87 | 76.97 |

Numbers are **PROJECTED**, using retained Phase 3 workload assumptions and explicitly stated codec factors. Phase 3 before: 935.75 MB D1 / 15.27 GB R2 with an assumed eight directories. The eight-directory Phase 4 scenario is 5.87 GB, but no active eight-generation pruning exists. Conservative all-daily-checkpoint retention yields 52.51 GB; this corrects the previous retention omission rather than claiming measured R2 growth. No changed-checkpoint sharing reduction is credited. Unknown domain volumes stay null. A minimum sustainable whole-product footprint is not established.

## 13. Updated $0 capacity

| DAU | Worker requests/day | D1 reads/day, lower bound | D1 writes/day, lower bound | D1 MB, 365d | R2 GB, 365d | R2 A/month, lower bound | R2 B/month, lower bound |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 | 13,798 | 2,016,994 | 70,911 | 382.99 | 22.96 | 272,355 | 10,827,643 |
| 500 | 36,851 | 2,284,322 | 81,311 | 624.85 | 36.09 | 285,817 | 14,474,233 |
| 1000 | 65,668 | 2,618,482 | 94,311 | 927.17 | 52.51 | 302,644 | 19,032,493 |
| 1500 | 94,484 | 2,952,642 | 107,311 | 1229.49 | 68.94 | 319,472 | 23,590,753 |
| 2000 | 123,301 | 3,286,802 | 120,311 | 1531.81 | 85.36 | 336,299 | 28,149,013 |
| 3000 | 180,934 | 3,955,122 | 146,311 | 2136.45 | 118.20 | 369,954 | 37,265,533 |
| 5000 | 296,201 | 5,291,762 | 198,311 | 3345.73 | 183.89 | 437,263 | 55,498,573 |

**Verified maximum sustainable whole-product DAU at $0: NOT ESTABLISHED.** The bundle is a traffic-independent Free blocker. The 1,000-DAU scenario also exceeds D1 database/storage targets, write headroom, R2 storage/read allowances and implemented editorial mail capacity. Production CPU and unported domain workload could constrain it further. Local incremental spend $0; production monthly cost UNVERIFIED, no paid fallback activated.

Public account-wide budgets checked 2026-10-18: D1 5M rows read/day, 100k written/day, 5 GB/account, 500 MB/database; Workers 100k requests/day, 10 ms CPU/invocation and 3 MiB compressed artifact; R2 Standard 10 GB, 1M Class A and 10M Class B/month; Workers AI 10k neurons/day. Apply 30% operational headroom and subtract other account usage. More D1 databases do not multiply daily quotas. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## 14. Remaining production blockers — Phase 3 vs Phase 4

| Blocker | Phase 3 | Phase 4 / evidence | Remaining work |
|---|---|---|---|
| Storage/operations | 936 MB D1, 15.3 GB R2 subtotal | PARTIAL: gzip/tree/directory reuse, exact fixture pages and conservative corrected model | Compact retained transactional directories, safe changed-checkpoint retention and full workload counts; meet write/read budgets |
| D1 application | Account subset staged | PARTIAL: actual daily trivia/yard award APIs, typed migration and compact scheduler history | Full Front Office, multiplayer trivia, reward UI/claims, Parlay IDs/board/Lab Score and remaining domains |
| Framework | Next 14/legacy adapter | PARTIAL: supported Next 15/OpenNext, actual local runtime probes | Reduce/split supported artifact without removing functionality; qualify startup/memory and secure password hashing |
| Worker CPU | Unverified | UNVERIFIED: local timings/counters only | Explicitly approved cloud synthetic CPU traces; no deployment authorized here |
| Providers | Mocks/staged services | UNVERIFIED live; local contracts retained | Approved sandbox inference/delivery/rights/partner checks and account entitlement |
| Recovery scale | 61 tables/132 rows/4 objects | PARTIAL: 74 tables/15,535 rows/1,603 objects, faults and resume | Streaming full-year load, off-account keys, cutover/read gate and retention execution |
| Native validation | JS builds only | UNVERIFIED devices; no renderer redesign | Device deep links, provider actions, error states and push before integration |

## 15. Recommended next phase

Review this isolated commit. Do not cut over or deploy. The smallest demonstrated path is to finish one stateful business vertical at a time with real route/transaction parity, compact old indexed history without losing lookup/replay, define the required backup rollback window before reference-safe pruning, and reduce the supported Worker artifact below Free size. Qualify secure Worker auth and approved synthetic CPU/provider traces only after those local gaps close. A second D1 alone cannot fix account-wide writes, R2 reads, email demand or artifact size. No architecture currently earns a 1,000-DAU $0 readiness claim. Stop for review.
