# Down & Distance RC3 final handoff

Baseline: `release/down-distance-rc2` / `4ebdf17e`. Qualification is local, synthetic, and private. No deployment, remote resources, production access, billing activation, live provider calls, or remote job activation occurred.

| Required result             | Qualification                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACCOUNT ERASURE             | **PASS** locally, including final coordinated payload cleanup and pre-deletion archive revocation replay                                                                  |
| RETENTION CLEANUP           | **PASS** locally, including interrupted compaction, maintenance restart, and cross-shard reconciliation                                                                   |
| SCHEDULER                   | **18,504 / 18,504** actual completed checks                                                                                                                               |
| MULTI-D1                    | **PASS** — ten physical local D1 databases                                                                                                                                |
| AUTHENTICATION              | **PASS** locally; hosted CPU remains unverified                                                                                                                           |
| RECOVERY                    | **PASS** locally; current independent encrypted erasure ledger required for restore                                                                                       |
| MAXIMUM D1 QUERIES          | **49** per sampled application invocation; erasure maximum **15**; retention step maximum **14**, including injected failure recovery                                     |
| DAILY D1 WRITES             | **77,108 measured**: 77,038 application replay + 70 coordinated maintenance writes                                                                                        |
| AUTOMATED TESTS             | **1,249 distinct passed**, zero final failures, two existing skips: 1,079 application + 168 full Worker/D1 + one additional uncertain-transfer regression + one mTLS test |
| BROWSER TESTS               | **48 passed**; KC/SEA at 390px and 1440px, plus authenticated HTTP product workflows                                                                                      |
| PRODUCTION BUILD            | **PASS** — 95 pages, 200 API routes, Next/OpenNext and split Worker compilation                                                                                           |
| WORKER DRY RUNS             | **5 / 5 PASS** — password, API, Web, odds processor, application                                                                                                          |
| LOCAL RELEASE QUALIFICATION | **PASS** for bounded private synthetic staging                                                                                                                            |
| READY FOR HOSTED STAGING    | **YES**, as an owner-gated synthetic qualification trial; hosted qualification is outstanding                                                                             |
| REMAINING HOSTED GATES      | Account quotas/capacity, access controls, per-Worker CPU, hosted coordinated recovery, and separately authorized live integrations                                        |
| EXACT OWNER ACTIONS         | Listed below; no deployment authorization is implied                                                                                                                      |
| BRANCH                      | `release/down-distance-rc3`                                                                                                                                               |
| COMMIT                      | `fb947516ba714cb801ea1a3711724d45bb7a8224` — implementation, tests, and validation evidence; this handoff is a subsequent documentation commit                            |

## Account erasure

Acceptance atomically deactivates the authenticated account and records its durable job. Origin/confirmation/ownership checks remain enforced. Cookie and bearer access are immediately rejected; database mutation guards prevent stale authorized requests from recreating private rows or reactivating the identity. Operator continuations accept no caller-selected user.

Each continuation removes or redacts at most 25 selected rows and advances its cursor in the same guarded transaction. RC3 finishes consent removal, security audit anonymization, terminal commerce redaction, shared container anonymization, Trivia host detachment, and terminal transfer cleanup. Shared content from other users remains preserved. Anonymous account tombstones preserve shared ownership and moderation relationships; anonymous security event facts and required financial transaction IDs remain retained. No shared container is deleted through an unbounded child cascade.

The job transitions to `AWAITING_GC` after private row cleanup. It becomes `COMPLETE` only after all ten shards have undergone verified stopped-writer archive/reconciliation/GC and erased mail ciphertext is confirmed absent. A hash-only inventory recognizes erased mail as leaf ciphertext without treating arbitrary opaque payloads as disposable. Unresolved ownership/references continue to fail closed.

Pending/uncertain external transfers and unfinished commerce explicitly remain `REVIEW_REQUIRED`, with access revoked and their reconciliation evidence preserved. The additional regression verifies that a pending transfer is unchanged and cannot be mistaken for completed erasure. Such an account must not be reported complete until its outstanding work is reconciled. This is a tested retention boundary, not a claim that real external transfers were performed.

The populated recovery test preserves other-user credentials/preferences and pinned data across all ten owners, restarts during cleanup, removes private ciphertext, and reaches `COMPLETE`. The 101-save regression also reaches `COMPLETE`. Web and native deletion wording now distinguishes immediate loss of access from continuing data cleanup.

Historical encrypted recovery archives remain preserved under the existing recovery policy. Restore now requires a separately authenticated **current erasure ledger**, rather than relying on an old archive's deletion state. Revocation is replayed before restored databases are unlocked. Restored pending erasures then finish through the same continuations and maintenance procedure; an old archive cannot silently reactivate a deleted account. The owner must supply the latest ledger, not an older copy paired with the archive.

## Retention and recovery

The 90-day published article policy, saved articles/corrections, permanent saved betting evidence, Front Office progress, preferences, earned points, original IDs, and attribution remain protected. Unknown references and non-owned pins are preserved.

Completed odds processing older than 30 days compacts into identity receipts only when its fetch run is complete and its publication is no longer current. Unfinished/uncertain work and active publications retain their bodies. Compact receipts preserve slot, provider event ID, canonical event ID, timestamp, terminal status, and provider attribution; uniqueness still prevents replaying old work. Capacity accounting, receipt publication, audit, and cursor updates are atomic. Saved evidence continues to protect referenced payloads through the existing fixed-point graph.

A completed editorial handoff releases its duplicate body only after destination candidate/receipt verification. Its source ID, external ID, original URL, handoff ID, and destination remain intact. Missing destination proof retains the body. Keyset paging proceeds past unresolved records, and interrupted audit publication rolls back the body change.

Owner maintenance retains all ten write fences on failure. `resume-maintain` authenticates the original persisted archive, requires matching locked epochs, resumes committed retention cursors, safely rebuilds incomplete preparations, and completes bounded GC batches before unlocking. Tests inject both a retention transaction failure and a maintenance process interruption/restart. No remote cleanup endpoint was added.

Maintenance is an offline owner process. The measured complete archive/export/reconciliation/GC operation used **5,015 statements**, **33,708 rows read**, and **70 rows written** across ten databases. That whole offline operation is not a Worker invocation; its statement total must not be compared with the per-Worker bound. Individual retention steps measured at most 14 statements. Evidence is in `reports/rc3/validation/retention-measured.log` and the replay's `maintenanceMetrics`.

## Scheduler root cause and replay

RC2 rebased each successful source deadline to its completion time. The bounded serial owner runner delayed some polling during ingestion/publication bursts, permanently shifting those sources' cadence. Durable cursors and inboxes drained the backlog but did not recover the lost due slots. The source-level comparison identifies **160 recovered checks across 96 sources**; source removal, routing loss, lease corruption, and a hidden final backlog were not required to explain the discrepancy.

RC3 advances a successful source from its stored due slot by exactly its existing interval. Overdue slots remain due until actual fetches complete them. Initial epoch-zero sources start at their first real check; failure backoff remains unchanged. The regression asserts real fetch counts, persisted deadlines, and request counts. No loop bound or source interval was increased, and no completed checks were fabricated.

The final synthetic day preserves **97 active sources / 32 teams**, 96 arrivals, 96 corrections, synthetic odds/scoring, 50 followers, and briefing publication. It runs **1,440 one-minute parent invocations**, each with the existing **32-child-call bound**, and completes **18,504/18,504**, with no final pending jobs/inbox or failed source checkpoints. Twenty-seven ticks reach their bound and resume durably. A second full-day run deliberately misses 30 consecutive ticks, executes 1,410 parent invocations, and still completes **18,504/18,504** with a 49-statement maximum. The Monday/Wednesday/Saturday sportsbook refresh schedule is unchanged.

The measured **77,108 writes** cover this synthetic application day plus stopped-writer archive/export/maintenance. General HTTP user traffic, real provider capture, delivery, and hosted indexed accounting are outside that measurement. The inherited 81-private-writes/DAU assumption and 1,125 raw-refresh-write estimate would yield an **82,283 planning subtotal at 50 DAU**, not a complete account capacity certification. Ten shards do not multiply the account's daily allowance. The 470 MB sensitivity model was not optimized; the actual 500 MB database limit and existing payload admission safeguards remain in force.

Reproduce the main replay with `NODE_PATH=./workers/content-engine/node_modules TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/qualify-rc2-combined-day.ts`. For the interruption replay, additionally set `DD_SCHEDULER_SKIP_FROM=60 DD_SCHEDULER_SKIP_MINUTES=30 DD_QUALIFICATION_OUT=reports/rc3/backlog-day`. Data and provider responses are synthetic; outbound provider traffic is blocked.

## Validation evidence and limits

`reports/rc3/validation/summary.json` records decisions separately from check counts. Application/Worker logs, HTTP authentication/revocation evidence, build/dry-run evidence, interrupted-cleanup tests, scheduler source deltas, and browser screenshots are committed under `reports/rc3/`. Earlier milestone reports were preserved unchanged.

The first full Worker run had four isolation failures because its runner supplied `DATABASE_URL=''` while existing tests required the variable to be absent. The runner was corrected; assertions were preserved. The final complete run passed 168/168. The newly added uncertain-transfer case passed separately, as did the final measured retention tests. No tests were removed or assertions relaxed.

The root and `tsconfig.completion.json` release checks pass. An additional direct check of the legacy `workers/content-engine/tsconfig.json` fails on its existing application alias/lib configuration; its diagnostic log is retained and is not represented as a passing check. The release project check covers the actual Worker adapters, and all five real Worker dry runs pass. Existing Next lint/Edge warnings remain visible in the build log.

Browser automation checked desktop/mobile web routes and product workflows in KC and SEA. KC/SEA mobile-web screenshots were visually inspected. Native changes are wording-only in the existing React Native screen. **No Android/iOS build, simulator, or device validation was performed**, and browser viewport tests do not establish native validation. Hosted CPU, live AI, email/push delivery, sportsbook transfer, and account-level capacity were not tested.

## Remaining hosted gates and exact owner actions

1. Review this commit and the retained evidence. Keep every staging Cron Trigger and ingestion/delivery flag disabled. Existing `config/rc2.*.toml` filenames are intentionally reused as the reviewed five-Worker staging templates; the code and migrations must come from this RC3 branch.
2. Independently verify the actual Cloudflare account's Free-plan eligibility, ten available D1 slots, existing account-wide reads/writes/request usage, actual database sizes, and absence of billing upgrades. No R2 or PostgreSQL binding is required. Do not substitute modeled capacity for these checks.
3. After separate owner authorization, configure isolated staging-only database IDs, all ten role-specific migration paths (including users migration `0008_account_erasure_completion.sql`), staging secrets, approved hostname, and individual tester mTLS fingerprints. Review `scripts/rc2-staging-commands.py` for command generation. Do not apply the old single-D1 migrations over role schemas or reuse production credentials.
4. Qualify hosted mTLS denial/bypass behavior for assets and APIs, staging authentication, and per-Worker CPU with the unchanged Argon2 parameters. Keep internal Worker public endpoints disabled. Admit only bounded synthetic jobs under explicit authorization; preserve no-billing and quota guards.
5. Test a stopped-writer, ten-shard hosted encrypted backup/restore with a current independent erasure ledger, reference verification, revocation replay, cleanup, and fail-closed recovery before onboarding real users. Hosted recovery timing and account-level capacity remain unverified.
6. Separately authorize and qualify any live AI, email/push, raw sportsbook provider capture, or real sportsbook transfer. Verify entitlement, request/write headroom, and uncertain-attempt reconciliation before enabling those integrations. No such credential or service was activated here.

Local owner procedures require `DD_OFFLINE_BACKUP_KEY` outside the repository and genuinely stopped writers:

```sh
# Backup/maintain also writes an independent encrypted ledger, defaulting to ARCHIVE.erasures.json.
npx tsx scripts/multi-d1-owner.ts backup --local PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED
npx tsx scripts/multi-d1-owner.ts maintain --local PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED
# Resume the original locked maintenance window using its original persisted archive.
npx tsx scripts/multi-d1-owner.ts resume-maintain --local PERSIST_DIR ORIGINAL_ARCHIVE_JSON WRITERS_STOPPED
# Explicitly select the latest independent ledger when restoring any historical archive.
DD_ERASURE_LEDGER_PATH=LATEST_LEDGER_JSON npx tsx scripts/multi-d1-owner.ts restore --local NEW_EMPTY_PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED
```

Never restore over occupied databases, unlock a failed maintenance window by guessing, discard uncertain external evidence, or report an `AWAITING_GC`/`REVIEW_REQUIRED` account as complete. All remote resources and jobs remain untouched. This session stops at local implementation, validation, commits, and this handoff.
