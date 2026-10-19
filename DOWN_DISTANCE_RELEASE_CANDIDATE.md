# Down & Distance release candidate 1

Branch: `release/down-distance-rc1`, based on `09f38f67`. Isolated worktree: `/private/tmp/down-distance-staging-preparation`. Local synthetic data only; no deployment, remote resources, production access, billing, real email, or real sportsbook submission.

**Release qualification: FAIL. Core multi-D1 workflows are integrated, but the existing account-erasure path exceeds the request budget, combined-load/hosted capacity remains unqualified, and remote staging prerequisites are absent. Staging activation remains NO-GO.**

Local statuses: routing PASS; editorial PASS; global IDs PASS; cross-shard references PASS; batched polling PARTIAL (combined-load freshness); Parlay Lab PARTIAL (live transfers/provider coverage); retention PARTIAL (conservative operational roots/pins); recovery PASS within the documented local archive bound; authentication PASS.

## Implemented

- Eight deterministic team databases, D1_USERS and D1_SHARED. All 32 teams retain their original division mapping. Single-D1 and PostgreSQL rollback code and original migrations remain intact. No mandatory R2 binding.
- Team-owned ingestion, candidates, canonical/public stories, versions, corrections, search, Three & Out and Film Room paths now use explicit ownership. Shared global-ID hints contain identities only. Missing hints repair from authoritative owners; conflicting IDs fail closed. Cross-team source discoveries use durable phased handoffs, disabled source replicas and original checkpoints.
- Atomic local publication also commits a dispatch intent. Separate resumable continuations update routing/review metadata and deliver deduplicated private notifications. Approved briefing email templates transfer into the private outbox before acknowledgment.
- Saved articles use owner validation, PREPARED/COMMITTED receipts and verified target pins. Client-provided owner metadata cannot choose a database. Saved slips preserve their complete user snapshot and conservatively pin matching source boards. Legacy/unreceipted references block cleanup. Unsave currently over-retains pins; no unsafe asynchronous unpinning.
- Shared cross-team odds and private transfer jobs are separated. Each sportsbook price carries its own original selection ID rather than inheriting another book’s ID. Original provider market/player/book identifiers are retained when actually supplied; derived keys are labeled separately. Compact event directories avoid loading unrelated boards. Provider capture is one event/page; board publication and scoring are separate leased phases. Ambiguous provider attempts remain UNCERTAIN, requiring reconciliation. Original Monday/Wednesday/Saturday odds cadence is unchanged.
- Shard polling retains batched leases/inboxes and idempotency. Bounded runners persist owner/action/batch continuations. Empty owners advance without three empty follow-up calls. Daily generation accounting uses a compact counter instead of repeatedly summing the entire run history.
- Three & Out generation advances one team per API invocation. Multi-D1 delivery processes one eligible recipient, reads the team owner, and retains private daily claims. Missing briefings request separate generation with backoff. Email fanout and sends use separate bounded private API requests; mail reservations commit atomically with D1_USERS outbox state.
- Coordinated maintenance locks all ten epochs before export, verifies cross-shard roots, persists and authenticates an encrypted archive before retention/GC, and keeps all locks if maintenance fails. Restore authenticates every shard before any destination write, requires empty isolated targets, restores content before private references, checks integrity/FKs, and unlocks only after reconciliation. This is a stopped-writer consistency protocol, **not an atomic cross-database snapshot**.
- Owner archives support authenticated ordered chunks beyond the application object's 4 MB limit. The reviewed owner-tool bound is 256 MB serialized SQL per shard; larger exports fail closed and require a streaming exporter. The 64 MB encoded-payload admission guard and 500 MB database hard limit remain unchanged.

## Evidence and limits

| Check | Result |
| --- | --- |
| Full application suite | 1,079 passed; 0 failed; 2 existing skips (PostgreSQL-only fixture and real-HTTP trade fixture; the latter runs separately in the browser harness) |
| Full Worker/D1 suite | 161 passed; 0 failed; 0 skipped (complete suite); final focused integrity rerun also passed 4/4 |
| Browser | 48 Chromium mobile/desktop viewport checks; authenticated product, trade, saved-content and restart checks pass on ten physical local D1 databases |
| Authentication | Actual local workerd; Argon2id m=19456, t=2, p=1, native PHC compatibility; registration, login, invalid credentials, reset/single use, expiry, concurrent sessions, logout isolation and restart pass |
| IDs and references | All 32 team IDs, cross-team save isolation/restart, phased cross-team ingestion, reference-aware maintenance pass |
| Recovery | Missing/corrupt archive, interrupted backup/restore, preferences, original password metadata/IDs, Front Office progress, and owner CLI restore pass; >4 MB Unicode export round trip passes |
| Parlay | 2,000-market capture/publication/scoring, 16-event transfer lookup, saved evidence and uncertain-attempt recovery pass with synthetic provider responses; no real FanDuel/DraftKings transfer verified |
| Three & Out | All 32 generation continuations, correctly owned delivery, maximum 24 statements in targeted check |
| Build/configuration | Next/OpenNext production build (95 pages), full TypeScript check, and five Wrangler dry runs pass; all crons empty, ten distinct D1 IDs, no R2 bindings; existing lint/Next Edge compatibility warnings remain |

The browser exercises Home, The Beat, Film Room, Three & Out, The Huddle, AI Search, Trivia/Move the Chains, Front Office, Parlay Lab/Trending Props/Bet Slip, Profile, authentication and saved content. Layout checks use KC and SEA themes and mobile/desktop browser widths. These are not native Android/iOS device tests. Shared saved-slip types/compaction serve both renderers; native builds and device visuals remain unverified. Empty synthetic sportsbook/statistical coverage is not evidence of live provider completeness. The browser fixture has only one published article, so the edition API deliberately returns 503 until three verified stories exist; populated Three & Out generation/delivery is validated separately in the seeded integration test.

The first complete Worker run found two failures: oversized-board validation order and a mail fixture whose ten-second clock margin expired under slow execution. The size guard was restored before preparation, and the fixture now uses a fixed processing clock with unchanged assertions. Both affected files then passed all nine tests; final full-run results appear above.

Evidence: `reports/release-candidate/` contains browser/auth samples, full regression logs, build dry runs, workload samples and scheduler results. Existing milestone reports are preserved separately from this run.

## Measured query and quota results

- **Mixed 24-hour local workerd replay:** all 32 teams; 120 registered sources, 97 active RSS sources, **18,504 source checks**, 96 new stories + 96 corrections, 32 briefing publications, 16 events × 2,000 markets, real deterministic synthesis/scoring and 50 synthetic notification followers. **78,174 rows written, 595,215 rows read, 37,690 fixture invocations, maximum 49 statements; zero over 50.** User setup is excluded. This driver drains virtual-minute continuations without a hosted cron cap; it does not establish mixed-load wall-clock freshness.
- **Separate bounded schedule:** actual automation route + 32-call runner, 24 virtual hours, unchanged synthetic RSS: **18,504/18,504 checks, 19,488 requests, zero capped ticks, maximum 24 statements**, 59,277 local rows written and 469,533 read including registry preparation. It does not include editorial arrivals.
- Large provider event: capture **46**, board phase **38**, score phase **44** statements. Cross-event transfer lookup: **5** statements for 16 events. Query count is not rows read: selected-event JSON lookup still scans compact market metadata (approximately 15,000 rows in the unrelated-event sensitivity sample).
- Final mixed replay reduced reads from the earlier 50-follower run's **1,830,543 to 595,215** by replacing repeated generation-history scans. Writes changed **78,222 → 78,174**; routing is not free. Correction publication measured **29** statements. The preferred 70,000-write/30-query targets are not met universally.
- Fixture physical storage across all ten databases grew **5,070,848 → 8,646,656 bytes**. This is a one-day synthetic measurement, not an annual projection. The last additive private email-limit table adds a small schema page; mature saved-board growth remains unqualified. The owner's modeled 470 MB exception is respected without disabling actual admission guards.
- **Planning, not measurement:** adding the inherited 81 private writes/DAU/day assumption to the mixed replay gives **82,224 writes/day at 50 DAU**. Replacing direct fixture odds publication with the measured capture/board/score phases adds about **1,125** writes on a refresh day: approximately **83,349/day**, before unmeasured full email/push fanout, recovery/export and hosted accounting differences. Two further correction versions conservatively add approximately **12,557**, leaving roughly **4,094 writes** below the shared 100,000 limit before those omissions. Adequate worst-case headroom is **not demonstrated**. Do not enable production ingestion on this estimate alone.
- D1 quotas are account-wide across all ten databases. Local `rows_read`/`rows_written` metadata includes measured statements/guards; no invented additional index multiplier is added. Hosted CPU, account headroom, actual billing/plan eligibility, live provider quota and geographically realistic latency are unverified. No additional daily allowance is attributed to extra databases.

## Exact staging prerequisites and commands

1. Review this branch and approve isolated remote staging preparation separately. Verify the actual account's Workers/D1 Free availability, ten database slots, aggregate storage/read/write headroom and no-billing settings. This session did not access the account.
2. Create/identify **only after approval** ten empty staging databases. Put their real staging IDs in `config/rc1.api.toml`, `rc1.web.toml`, `rc1.application.toml` and `rc1.odds-processor.toml`; each binding must refer to the same physical owner everywhere. Templates deliberately contain synthetic IDs and `remote=false`.
3. Configure a staging-only hostname behind Cloudflare Access with an explicit owner/tester allowlist and default denial; no public or bypass policy. Populate Web `ACCESS_TEAM_DOMAIN` and 64-character `ACCESS_AUD`. The gate covers assets as well as application/API routes and denies missing/invalid assertions. Keep workers.dev and preview URLs disabled. API/password/processor/application Workers stay service-only. Do not change production DNS.
4. Supply isolated `AUTH_JWT_SECRET`, `APP_MAIL_ENCRYPTION_KEY`, `CONTENT_AUTOMATION_SECRET`, and `APP_MAIL_JOB_SECRET` where used, plus a staging-only `AUTH_BASE_URL`. Store an offline 32+ character `DD_OFFLINE_BACKUP_KEY` outside the repository. Never reuse production secrets. Provider/email/push secrets are optional and must remain absent until separately verified and authorized.
5. Keep all `APP_*_ENABLED` background/mail flags false, `CONTENT_AUTOMATION_GLOBAL_ENABLED=false`, public caching false, deterministic search, and **all Cron Triggers empty**. No R2, PostgreSQL, paid AI or fallback bindings. Live odds require verified provider entitlement and `ODDS_PROVIDER_DAILY_HTTP_CEILING`; an UNCERTAIN run must be reconciled against the provider before operator repair.

Local review commands (no deployment):

```sh
python3 scripts/validate-rc1-config.py
python3 scripts/qualify-role-schemas.py
DD_BUILD_WRANGLER_CONFIG=config/rc1.web.toml node scripts/build-split-worker.mjs
node scripts/prepare-rc1-dry-runs.mjs
```

After resource approval and real staging IDs, apply role migrations before serving traffic. Run each owner command explicitly; never apply legacy single-D1 migrations over role schemas:

```sh
# Repeat N=1 through 8 for the team role; names must match reviewed staging IDs.
npx wrangler d1 migrations apply D1_TEAM_1 --remote --config config/rc1.api.toml
npx wrangler d1 migrations apply D1_USERS --remote --config config/rc1.api.toml
npx wrangler d1 migrations apply D1_SHARED --remote --config config/rc1.api.toml
# Upload isolated secrets with wrangler secret put NAME --config CONFIG.
# Deployment order, only after explicit deployment approval:
npx wrangler deploy --config config/rc1.password.toml
npx wrangler deploy --config config/rc1.api.toml
npx wrangler deploy --config config/rc1.odds-processor.toml
npx wrangler deploy --config config/rc1.application.toml
npx wrangler deploy --config config/rc1.web.toml
```

The above remote commands are instructions only and were not executed. A staging URL cannot be stated before an approved hostname exists. Reject synthetic IDs/placeholders during owner review before deployment.

Health checks: deny anonymous and invalid-Access requests (403), verify allowed private `/api/auth/config`, register/login with synthetic accounts, check all teams and saved IDs across restart. Authorized `GET /api/automation/storage-health` uses the automation Bearer credential and reports per-owner storage/payload admission; account-wide operations remain explicitly unverified. Capture Worker TraceEvent `CPUTimeMs`/request outcomes with `wrangler tail WORKER --format json` and the Cloudflare usage dashboard; local wall time is not CPU. Measure API, Web, password and background Workers separately. Compare actual account rows/requests/storage before and after a bounded synthetic staging run; retain safety headroom before enabling schedules.

## Recovery, rollback and remaining gates

Local owner procedure: stop every scheduler/import/raw writer and HTTP write ingress first. SDK epochs do not stop raw SQL. With `DATABASE_URL` absent, set the offline key and use:

```sh
npx tsx scripts/multi-d1-owner.ts backup --local PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED
# Restore only into a NEW EMPTY isolated persistence directory:
npx tsx scripts/multi-d1-owner.ts restore --local EMPTY_PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED
# Destructive eligibility applies only to approved retention after verified archive read-back:
npx tsx scripts/multi-d1-owner.ts maintain --local PERSIST_DIR NEW_ARCHIVE_JSON WRITERS_STOPPED
```

These are **local-only tools**, not a remote exporter. Test a hosted stopped-writer export/import procedure on staging before depending on it for real users. Owner backup frequency determines RPO (a daily completed backup implies up to 24 hours); hosted RTO is unmeasured. Provider Time Travel is not a substitute for a verified coherent ten-database recovery point. Backups belong on owner-managed offline storage, not inside D1. Real archives and keys must stay outside public assets, build outputs and version control.

Emergency shutdown: disable content, briefing, odds fetch/processing, mail/social and maintenance flags; keep crons empty. Drain/reconcile in-flight intents before maintenance. UNCERTAIN provider/mail attempts require operator reconciliation, not blind replay.

Code rollback: stop writes; restore the previous Worker version/configuration and the coherent matching database backup in isolation. Preserve original databases for review. Returning to the single-D1 implementation requires an explicit verified data conversion; changing the flag alone does not merge shards or establish rollback correctness. Do not point rollback builds at production or at incompatible role schemas.

Remaining implementation blocker: `eraseD1Account` introspects **106** D1_USERS tables individually (at least **107** statements before occupancy checks), so it cannot complete within the 50-query invocation budget. It fails closed before deleting user rows. A bounded role-specific erasure workflow with shared-data isolation and recovery tests is required; legacy single-D1 erasure tests do not qualify this path. No account data was erased to work around the limit.

Additional lifecycle gap: completed processing/handoff receipts and conservative reference pins can retain source roots beyond nominal age. This prevents unsafe deletion but does not prove bounded long-term storage. Qualify receipt compaction and pin reconciliation against saved evidence before production ingestion.

Remaining gates: actual account/Access/resources/secrets, hosted CPU and complete mixed-load scheduler freshness, worst-case daily write headroom including deliveries/recovery, permanent saved-board growth and conservative pin reconciliation, hosted ten-database restore drill, live source/provider completeness, and real sportsbook transfers. No billing, ingestion or external delivery activation is approved by this report.
