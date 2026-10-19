# Down & Distance — D1 migration completion

Baseline: `poc/cloudflare-staging-blockers` / `f1b77f90`. Implementation: isolated branch `poc/d1-migration-completion`, worktree `/private/tmp/down-distance-d1-completion`.

**PostgreSQL-free operation: PASS locally for the tested application workflows.** The web, API and password Workers run through Wrangler/workerd with `DATABASE_URL` and `PRODUCTION_DATABASE_URL` absent. PostgreSQL access remains forbidden by the D1-mode guard; there is no fallback to Neon.

**Production migration/cutover sign-off: NOT COMPLETE.** Local runtime qualification does not establish recovery of missing legacy state, conversion of every historical operational record, hosted free-tier capacity, or live external-provider behavior. Remaining limitations are listed below. Nothing was deployed or activated.

## Implemented migration

Additive migrations **0028–0038 add 67 tables**, extend existing trivia/user/push directories, and preserve the PostgreSQL migrations and implementations. The complete table list is in [migrated-tables.json](reports/d1-migration/migrated-tables.json).

| Domain | Completed D1/R2 integration |
|---|---|
| Authentication/users | Existing Worker Argon2id, credentials, sessions and reset support retained; email-change requests/confirmation, content progress, catch-up visits, polls and predictions added. Prediction awards commit atomically with the prediction. |
| Front Office | Existing D1 command/aggregate implementation retained. Added offline conversion of verified executable PostgreSQL saves, immutable reference bundles, events, offers, route IDs and exact command receipts. Missing/incomplete runtime state is retained and reported for reconciliation. |
| Parlay Lab | Existing D1 odds, precomputed scores, saved content and grading retained. Added stored sportsbook proposals and durable transfer reservations, quota/concurrency guards and fenced polling. Odds refresh cadence remains Monday/Wednesday/Saturday. |
| Editorial | Sources, candidates, leased jobs, evidence, immutable revisions, publication decisions and wire events use D1 directories plus verified R2 envelopes. Material publication commits the editorial head, public projection and FTS index together. Live Film Room ingestion and game-story enrichment now use D1. |
| Scheduled jobs | Application scheduler can delegate authenticated content/briefing jobs through an API service binding, drain social inbox work, and retain mail/maintenance/odds jobs. New activation flags default false. Three & Out schema checks/delivery use D1. |
| Social/trivia | Huddle repository, Game Day storage, crews/invites, targeted shares, private photos/comments, Fan Pulse, full drills, groups, friend challenges, scheduled-event registration, standings and rewards ported. Existing disabled/concept surfaces were not activated. |
| Commerce | Catalog/admin/inventory, demo checkout, Stripe checkout persistence, webhook deduplication, retry reservations, fulfillment and refund limits ported. Stripe remains test-mode only; tests use fake providers or signed local events. |
| Notifications/account | Web-push endpoint ownership/cooldowns, durable social inbox outbox and atomic account-erasure planning added. Existing notification/device/consent adapters remain in use. |

Mutations use explicit SQLite queries, uniqueness/foreign-key constraints and atomic guarded D1 batches. No PostgreSQL SQL translator or asynchronous transaction emulation was introduced. R2 objects are immutable and digest verified. Large reference arrays use the existing chunked JSON tree instead of exceeding the 4-MB object bound. Reference ingestions are serialized by a lease.

## Original data and rollback

The offline importer first retains exact PostgreSQL `row_to_json` text in R2, then builds typed D1 copies on a **fresh, unserved target**. Additional converters handle social/trivia/commerce/user directories, notifications, editorial evidence/revisions, and executable franchise state. Original IDs are retained; imported commerce order counters advance past existing order numbers. Imported franchise receipts retain their request hashes and response bodies.

A failed target is retained for diagnosis; restart into a new target rather than serving partial imports. The source snapshot is unchanged. Incomplete legacy franchises are **not** initialized as new games: they remain archived and appear in the reconciliation result. Original PostgreSQL adapters, migration history and dump/restore support remain available.

Rollback before activation: keep the original PostgreSQL database/application configuration authoritative and discard no source data. A later cutover requires a writer freeze, verified complete snapshot/import and acceptance of reconciliation results. **Reverse replay of new D1 writes into PostgreSQL is not implemented by this change**; switching a live writer back without reconciling those writes would lose progress. No live cutover was performed.

## Validation

Final results and raw evidence are recorded in [validation-summary.json](reports/d1-migration/validation-summary.json) and the accompanying logs.

- Root automated suite: **1,063 passed, 0 failed**, 2 environment-gated tests skipped and exercised separately through the HTTP/rollback runners.
- D1/Worker suite: **119 passed, 0 failed**; includes existing archival/storage tests and the new domain, concurrency, migration and recovery tests.
- Browser: **48/48 passed**, Chromium desktop 1440×1000 and mobile-web 390×844, KC and SEA themes, against actual local web/API/password Workers.
- Browser HTTP contracts also cover two-account signup, versioned trade calls, Crew joining, a complete ten-question drill, group start, media progress, atomic predictions, private orders/saves, process restart, Stripe HMAC rejection/acceptance, and authenticated scheduled-job schema readiness.
- Actual workerd authentication: registration, native Argon2 PHC verification, wrong credentials, independent concurrent sessions, logout, expiry, encrypted reset mail, single-use reset, old-password rejection and restart pass. No mail provider was contacted.
- PostgreSQL rollback regression: **21 Front Office, 2 authentication and 1 sportsbook database tests pass** on a new disposable localhost database. All SQL migrations replay; synthetic dump/restore verifies 50 tables. These are rollback tests, not evidence of PostgreSQL-free execution.
- Recovery tests retain strict fresh-target requirements, interrupted restore, corruption/missing-parent rejection, original IDs, foreign keys, large objects and the existing synthetic user recovery fixtures.
- TypeScript checking and the complete split Worker build pass. Build uses a local dry run; **no deployment** occurs.

Two regressions found during implementation were corrected without removing tests: D1 invalid-email-verification responses exposed a database assertion instead of the normal invalid/expired-link error, and commerce migration seed rows prevented an empty disaster-recovery target. Commerce initialization now occurs lazily after migration.

Measurements are local wall time and D1/R2 behavior. **Hosted Worker CPU, geographic latency and production free-tier feasibility remain unverified.** Chromium mobile viewport testing is mobile-web validation; Android/iOS devices were not built or visually checked. Native rendering and navigation were not changed.

## Remaining PostgreSQL dependencies

[postgres-dependencies.json](reports/d1-migration/postgres-dependencies.json) lists application-source PostgreSQL references. Intentional rollback modules remain for auth, user/content, notifications, trivia and Front Office events. Shared repositories retain explicit PostgreSQL branches. PostgreSQL search/enrichment helpers remain available for the PostgreSQL backend; D1 search uses its own FTS/answer dependencies. `authDb()` and `searchDb()` reject access in D1 mode.

The Node/PostgreSQL default remains available for rollback. **Cloudflare configurations explicitly select `APP_DATA_BACKEND=d1`** and require D1/R2 bindings. Absence of a binding is an error, not permission to connect to PostgreSQL.

## Remaining blockers and review limits

1. **Historical cutover:** complete mutable state cannot be reconstructed from incomplete legacy saves. The importer reports these records and preserves their exact evidence. Historical operational tables that lack a typed converter remain in the lossless archive; `unportedTables`/converter results must be reviewed rather than treating schema creation as a complete live migration.
2. **Account erasure bounds:** erasure is one atomic, owner-scoped batch, including composite franchise keys. It fails closed if the occupied dependency graph exceeds the 50-statement application bound or contains unsupported cycles. R2 retained objects/backups follow retention; this change does not claim immediate physical purge of every archived private payload.
3. **Delivery capacity:** social inbox fanout is durable and deduplicated, with bounded delivery slices. The default scheduler drain is three notifications per tick. Large audiences need explicit throughput/quota qualification. No new provider or cron activation was enabled.
4. **External/live flows:** actual email/push delivery, OAuth providers, live sportsbook payment/refund/transfer services and live Game Day feeds were not qualified. Existing concept/demo behavior was not promoted to production readiness. Email-change persistence is tested; an end-to-end delivered email-change UI flow is not established here.
5. **Existing $0 blockers:** hosted Argon2/Worker CPU, annual storage/backup operations and full-product free-tier capacity remain the blockers documented in `STAGING_READINESS_REPORT.md`. This migration adds no evidence that those limits are met and performs no new broad infrastructure audit.

## Reproduction and integration

Use the isolated worktree with its existing dependencies. Relevant local commands:

```sh
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
python3 scripts/qualify-staging-postgres.py
node scripts/build-password-worker.mjs
node scripts/build-split-worker.mjs
node scripts/probe-staging-auth.mjs
node scripts/probe-staging-web.mjs
node scripts/validate-d1-browser.mjs
```

The Worker/browser harnesses create fresh local stores and whitelist subprocess environment variables. They assert that PostgreSQL URLs are absent, block external application/provider requests, and clean only their synthetic stores. The PostgreSQL runner initializes its own localhost cluster.

Review this branch and its historical-conversion/retention limits before integration. No production systems, Front Office production data, Parlay Lab production data or paid infrastructure were accessed. No existing user/editorial data was deleted. **Stop for review; do not deploy this report as an authorization to cut over.**
