# Down & Distance — Zero-Cost Production Readiness, Phase 3

## 1. Executive summary

**Production readiness: BLOCKED. Supporting 1,000 DAU at $0 is not demonstrated.** This phase implements and tests staged D1 account adapters, raw PostgreSQL import, API recovery, shared AI caching, mail infrastructure, concrete three-weekly odds ingestion and multi-batch cross-store recovery. It resolves the original test baseline. Major business-data migration, supported hosting, billed CPU and providers remain unqualified.

The Phase 2 1,291-DAU number was an editorial Cloudflare component estimate, not whole-product capacity. At 1,000 DAU, the day-365 **modeled data subtotal** is 935.75 MB D1 / 15270.81 MB R2, before unquantified domains. Neither fits Free storage targets. The measured worst game-state shape raises R2 further. Existing history was not deleted to make the model fit.

Worktree: `/private/tmp/down-distance-zero-cost-phase-3`; branch `poc/zero-cost-production-readiness-phase-3`; base `87101164`. PostgreSQL remains the default backend. No production access/deployment, paid activation, real sending or provider execution occurred. Stop for review after the local commit; this report does not authorize cutover.

## 2. Changes implemented

Additive migrations and reversible dispatch retain original PostgreSQL modules. Owner-scoped immutable documents/CAS, IDs and hashes preserve recovery integrity. The final security regression separates user metadata from server-owned R2 pointers and verifies owner/content-ID envelopes. Actual Next handlers exercise account/session/password/preferences/saved-slip flows on local D1. Web and native recovery/freshness use shared logic. Local build/config/instrumentation and clean fixture runners make gaps reproducible. Existing newly registered sources stay disabled pending rights/capacity qualification.

The 100-account benchmark adds 712704 D1 bytes with its stated fixtures, about 7127 bytes/account at that small population. Eleven high-entropy 2.1 MB game versions upload 46203258 bytes across two copies. R2 history still grows even when D1 holds only heads/receipts. The 4 MB application limit refuses larger commands without advancing the prior head; it never discards old state.

## 3. PostgreSQL migration results

34 populated rows from 50 synthetic source tables are retained losslessly; 21 typed target rows are imported. Ten source table families have staged mappings; no whole-product cutover occurred. Original IDs/hashes and source fingerprints survive restart/rollback rehearsals. The inventory covers 115 historical declarations and detected SQL/connection sites, with dynamic-review gaps explicit. Most business tables retain PostgreSQL. **Verified Neon compute eliminated: 0.** See POSTGRESQL_TO_D1_MIGRATION_RESULTS.md before selecting D1 globally.

## 4. Hosting implementation

OpenNext/Static Assets configuration, build/dry-run and local runtime probes execute. The legacy adapter needs a documented process compatibility flag; manual redirects fix a concrete middleware failure. Next 14/old OpenNext and original-strength Worker password auth remain blockers. The Worker is 2832.32 KiB compressed; no cloud preview/deployment occurred. Static export cannot replace required APIs/SSR. Every local response, including unavailable endpoints, is in CLOUDFLARE_HOSTING_IMPLEMENTATION.md.

## 5. Worker performance

Actual D1 metadata/R2 instrumentation, ten-family local HTTP benchmarks and a privacy-filtering cloud CPU export parser are implemented. Wall time/zero workerd timer ticks are not CPU; streaming can exceed header-time counters. Free CPU/startup/memory/cache behavior remains UNVERIFIED. See WORKER_PERFORMANCE_PHASE_3.md.

## 6. AI architecture

Source-versioned shared results and D1 leases/quota reservations prevent repeated team generation. The opt-in Workers AI summarizer validates output/citation IDs; configured providers fail explicitly instead of substituting invented summaries. FTS returns real lexical results/attribution, with unknown timestamps/classification labeled unavailable. Structured/vector answers remain unavailable in D1 mode. Hosted quality/account usage and AI/voice functions remain unqualified. A 200-generation example reserves 7,000 estimated neurons/day, not observed billing. See ZERO_COST_AI_IMPLEMENTATION.md.

## 7. Email implementation

Encrypted deduplicated staging, recovery/UI flows, a concrete provider, preference/opt-out checks, bounded drains and uncertain-failure handling execute locally. Actual delivery/publication wiring is unfinished. Implemented conservative tier: 60 daily editorial recipients plus ten transactional attempts. Verified public Broadcasts terms provide a separate potential 1,000-contact tier, or 700 with margin; consent/segment/webhook integration and actual entitlement remain unverified. This phase does not claim 1,000 subscribed users receive mail. See EMAIL_DELIVERY_IMPLEMENTATION.md.

## 8. Parlay Lab scheduling

Three odds windows/week are declared with provider flags disabled. The existing-client wrapper reserves quota before requests, preserves alt/book payloads, publishes verified R2 references and records partial/uncertain/missed status. Web/native freshness never calls unknown odds live. Per-event mirrored R2 work still needs CPU/memory qualification; internal-service and external-fetch allowances are accounted separately. Current board endpoints, Lab Score precompute and transfer/grade queues still need complete D1 integration; actual partner/provider execution is unverified. See PARLAY_LAB_SCHEDULING_RESULTS.md.

## 9. Backup and recovery

Cold all-logical-table D1 + full-primary-namespace R2 recovery executes locally, with large game state, saved IDs, original auth metadata, history, configuration and writer epochs. Body backups are shared between manifests; encrypted directory chunks/resume receipts remove the previous single-50-statement restore limit. The rehearsal restores 61 tables/132 rows and 4 objects after an interruption. It is not an online/full-production/off-account recovery qualification. Memory/row limits, retention and serving/cutover gates remain blockers. See CROSS_STORE_RECOVERY_RESULTS.md.

## 10. Integration test results

| Executed suite | Passed | Failed | Skipped |
|---|---|---|---|
| Application Node | 1059 | 0 | 2 |
| D1/R2 + Node-on-D1 routes | 88 | 0 | 0 |
| Front Office PostgreSQL | 21 | 0 | 0 |
| PostgreSQL auth | 2 | 0 | 0 |
| Sportsbook PostgreSQL fixtures | 1 | 0 | 0 |
| Trade HTTP | 1 | 0 | 0 |

Chromium: 48 route/viewport cases, 0 failures. Two conditional skips remain in the standalone command; **both execute and pass in their dedicated isolated integrations**. They are not unresolved coverage gaps or counted twice as passes. SQLite page tests have a separate log. Local Worker probe statuses are reported separately from applicable suite passes. Native bundle compilation is not device validation.

The 48 Chromium cases cover Homepage, Beat, Film Room, Parlay Lab, account, Three & Out, Huddle, Trivia, rewards, Front Office and recovery/verification at 1440/390 widths with KC/SEA contexts. These include empty/error states on partial synthetic PostgreSQL, not feature data completeness. Invalid-link forms remove URL tokens; D1 handler tests separately exercise success. Mobile reset errors and Seattle desktop Parlay freshness were visually inspected. Native screens remain React Native; iOS/Android JS bundles compile offline. Devices/simulators, push, universal links, actual AI/email/sportsbook actions and cloud CPU remain unverified.

Full SQL migration stops at local pgvector availability. Native API contracts have account bearer/preferences/saved-slip coverage. Unported sports/game/trivia APIs are not declared migrated merely because Node tests pass.

## 11. Remaining blockers and comparison

| Blocker | Phase 2 status | Phase 3 status | Evidence | Next action |
|---|---|---|---|---|
| Baseline failures | 17 failures/two conditional skips | RESOLVED | Applicable suites pass; both skips execute separately | Retain clean runners and behavioral coverage |
| Full Cloudflare host | No compatible artifact/runtime proof | PARTIALLY RESOLVED | Local build/dry-run and authenticated SSR/API probes | Supported framework/adapter; complete data-backed endpoints |
| Free Worker CPU | Unmeasured | UNVERIFIED | Trace parser, D1/R2 metrics and local benchmarks | Approved synthetic cloud CPU/startup/memory traces |
| PostgreSQL/polling | Neon authoritative | PARTIALLY RESOLVED | Ten staged source mappings, raw import and explicit D1 dispatch | Port gameplay/rewards/odds/editorial; replace polling only after validation |
| Worker password auth | Original-strength hashing unqualified | BLOCKED | Node-on-D1 passes; Worker capability deliberately 503 | Supported secure hashing within qualified runtime limits |
| AI/voice | No qualified free inference | PARTIALLY RESOLVED | Shared cache/quota/FTS and concrete opt-in AI adapter | Hosted quality/billing calibration, complete answers and voice strategy |
| Recovery/subscription mail | No delivery adapter; volume gap | PARTIALLY RESOLVED | Queue/provider/UI/opt-out implemented; 60 daily editorial sends | Actual delivery/publication integration; Broadcasts consent/segment/webhook sync |
| Three-weekly odds | Primitive only | PARTIALLY RESOLVED | Concrete provider wrapper, durable quotas, snapshots/freshness | D1 board/Lab Score integration, reconciliation, provider/partner qualification |
| Cross-store recovery | Small lean-only fixture | PARTIALLY RESOLVED | 61-table/large-object cold restore with interruption | Streaming/off-account/key/cutover/retention rehearsal |
| Native devices/push/provider actions | Unverified | UNVERIFIED | Offline iOS/Android JS bundles; 48 web viewport checks | Device deep links/errors/push and real sportsbook actions |
| Whole-product/multi-year growth | Editorial-only limits exceeded later | BLOCKED | Full-category scenario subtotal and measured worst game shape | Reduce retained metadata/version/backup/write amplification without losing data |
| Account limits/rights/distribution | Unverified | UNVERIFIED | Public official quotas only; no account access | Account-wide resources, permissions, CI/store/voice/push costs |

The resolved baseline is local test reliability. Other areas have executable partial replacements; no production blocker is marked resolved from a quota spreadsheet alone.

## 12. Updated infrastructure costs

Incremental local infrastructure spend: **$0**. Projected production monthly cost: **UNVERIFIED; the 1,000-DAU scenario does not fit $0 allowances.** No paid fallback/account activation occurred.

Account-wide Free budgets used: D1 5M reads/day, 100k writes/day, 5 GB total and 500 MB/database; Workers 100k requests/day and 10 ms CPU/invocation; R2 Standard 10 GB, 1M Class A and 10M Class B/month; Workers AI 10k neurons/day. Other account workloads share these allowances. More D1 databases do not multiply daily reads/writes. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

The scenario assumes ten registered accounts/DAU, retained session/audit/trivia/points/slip/command/mail history, 0.5% active Front Office players making five commands/day, 100 KB normal game documents, 16 odds events/refresh at 100 KB/event, 200 shared summaries/day, two body copies and eight encrypted directory copies. Only fixture account bytes and the 2.1 MB worst game shape are measured. Actual per-table populations, legacy/vector/commerce/Huddle/private attachments beyond those envelopes, voice/push/CI/distribution/provider costs, conflicts and indefinite checkpoint retention are additional unknowns, not zero-cost assumptions.

The forecast charges daily verification of retained private immutable backup objects. Old AI/mail/version objects are not garbage-collected; derived caches also create cumulative cost. Eight directory copies are a planning assumption, not implemented pruning. Daily full backup needs streaming/exclusive orchestration beyond the fixture tool; no production backup scheduler is claimed.

## 13. Updated maximum sustainable DAU

**Whole-product verified maximum at $0: NOT ESTABLISHED. No launch capacity is certified.** All requested horizons/DAU scenarios and component assumptions are in capacity-model.json. At the smallest 100-DAU scenario, D1 storage/writes and R2 inventory reads exceed 30%-margin budgets. At 1,000 DAU the D1 database cap, R2 storage and operation quotas also fail. CPU/provider/domain unknowns can constrain capacity further.

### Capacity scenarios

All numbers PROJECTED unless expressly identified as measured. One account fixture does not qualify the unported table population. These scenarios retain history and reveal limits instead of dropping user data.

| DAU | Worker req/day | D1 reads/day | D1 writes/day | D1 MB day 365 | R2 MB day 365 | R2 A/month | R2 B/month | Daily email at 10% |
|---|---|---|---|---|---|---|---|---|
| 100 | 13,798 | 2,016,994 | 70,311 | 391.57 | 7764.79 | 272,355 | 10,826,443 | 10 |
| 500 | 36,851 | 2,284,322 | 80,711 | 633.43 | 11100.80 | 285,817 | 14,468,233 | 50 |
| 1000 | 65,668 | 2,618,482 | 93,711 | 935.75 | 15270.81 | 302,644 | 19,020,493 | 100 |
| 1500 | 94,484 | 2,952,642 | 106,711 | 1238.07 | 19440.83 | 319,472 | 23,572,753 | 150 |
| 2000 | 123,301 | 3,286,802 | 119,711 | 1540.39 | 23610.84 | 336,299 | 28,125,013 | 200 |
| 3000 | 180,934 | 3,955,122 | 145,711 | 2145.03 | 31950.87 | 369,954 | 37,229,533 | 300 |
| 5000 | 296,201 | 5,291,762 | 197,711 | 3354.31 | 48630.93 | 437,263 | 55,438,573 | 500 |

| Days | D1 MB at 1,000 DAU | R2 MB at 1,000 DAU | R2 MB with measured worst-size game shape |
|---|---|---|---|
| 30 | 198.97 | 2587.33 | 5587.33 |
| 90 | 330.93 | 4859.00 | 13859.00 |
| 180 | 528.87 | 8266.50 | 26266.50 |
| 365 | 935.75 | 15270.81 | 51770.81 |
| 730 | 1738.50 | 29090.13 | 102090.13 |
| 1095 | 2541.26 | 42909.44 | 152409.44 |

The JSON records every scenario at every horizon and every component assumption. CPU remains null/unverified. The implemented queue supports 60 daily editorial recipients with the reserved margin; Broadcasts is a separate promising tier, capped conservatively at 700 contacts pending implementation and account verification. No whole-product $0 launch capacity is certified.


At 1,000 DAU/day 365, one D1 needs 935.7 MB. Two perfectly balanced stores hold 467.9 MB each, above the 350 MB margin. Three hold 311.9 MB each but share daily writes/reads and the same 15270.8 MB R2 requirement. Cross-database consistency/recovery adds complexity without fixing those account-wide failures. PostgreSQL with caching is unqualified; caching cannot eliminate retained history or the still-active polling dependency.

## 14. Recommended next phase

Review the isolated commit, then complete end-to-end D1 verticals with exact route/transaction equivalence and historical fixtures. Prioritize Front Office shared-reference/delta storage, trivia/reward atomicity, odds board/Lab Score publication and lower-write queues. Use a supported framework/adapter and qualify original-strength password auth before any Free cloud preview. Implement Broadcasts consent/segment/webhook synchronization if that verified tier is selected. Add streaming, reference-safe backup/retention tooling and rerun full byte/operation projections before proposing a launch capacity.

Scope cloud/provider verification only after the exact supported artifact and synthetic resource/rollback specification are reviewable. Preserve PostgreSQL/history/current schedules until replacements pass. Do not deploy or remove data from this POC's estimates. Stop for review.
