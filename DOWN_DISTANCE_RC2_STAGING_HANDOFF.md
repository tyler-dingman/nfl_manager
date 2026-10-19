# Down & Distance RC2 staging handoff

Baseline: `release/down-distance-rc1` / `48bede9f`. Worktree: `/private/tmp/down-distance-rc2`. Branch: `release/down-distance-rc2`. Commit: the local commit containing this report (`git rev-parse HEAD`). No remote resources, production access, deployment, billing, real email or real sportsbook submission.

**RELEASE CANDIDATE: FAIL. LOCAL STAGING READINESS: NO. HOSTED STAGING READINESS: NO.** This is an engineering checkpoint, not approval to deploy. The new combined measurement disproves exact source-cadence qualification under the sampled arrival burst. Erasure and lifecycle work remain incomplete; neither test counts nor a smaller sampled write total overrides those gates.

| Release decision | Status |
| --- | --- |
| ACCOUNT DELETION | FAIL — bounded deactivation/cleanup works; shared/legal review and final purge remain incomplete |
| MULTI-D1 | PASS locally; ten-owner architecture preserved |
| EDITORIAL | PASS locally |
| CROSS-SHARD REFERENCES | PASS locally; conservative betting retention remains |
| BATCHED POLLING | PARTIAL — complete mixed replay misses 160 expected checks |
| PARLAY LAB | PARTIAL — synthetic provider/transfer coverage; live providers unverified |
| RETENTION | PARTIAL — editorial unsave reconciliation implemented; completed operational roots remain conservative |
| RECOVERY | PASS within existing local coordinated archive bounds; hosted restore unverified |
| AUTHENTICATION | PASS locally; hosted Argon2 CPU remains a gate |
| MAXIMUM D1 QUERIES | 49 sampled application invocations; 8 erasure continuations; not a universal certification |
| MEASURED DAILY WRITES | 77,417, with scope and omissions below |
| PROJECTED 50-DAU WRITES | 82,592 planning subtotal, **not** a complete daily capacity estimate |
| TESTS PASSED / FAILED | 1,244 automated / 0 final failures; 2 existing skips; 48 browser viewport checks |

## Completed changes

The multi-D1 deletion endpoint now atomically deactivates the account, clears identifying profile fields, and records a durable private erasure job. Existing cookie and bearer authentication reject DELETED accounts. Database triggers reject inserts/updates referencing an erasing user, including requests authorized before deactivation. Transfer guards use the same HMAC actor identity as the transfer service. A deleted identity cannot be reactivated through a profile/auth update. The single-D1 implementation and rollback history remain intact.

Cleanup uses a committed, role-specific plan instead of 106 runtime PRAGMA calls. Each private operator continuation deletes at most 25 explicitly selected target rows in one guarded transaction with its cursor update. Empty phases advance; interruptions retry the same phase. The operator-only `POST /api/automation/account-erasure` accepts the existing automation Bearer credential and does not accept a caller-selected user. The user endpoint derives ownership from the authenticated session, still checks origin and DELETE confirmation, and returns 202 with `accepted:true, complete:false`.

**Deletion is not finished.** The queue ends at REVIEW_REQUIRED instead of claiming completion. The anonymous user tombstone preserves shared ownership and legal/security relationships. Commerce/security/consent records, shared Crew/game/Trivia containers and moderation relationships need a reviewed final anonymization/ownership policy. Private immutable payloads require a verified offline GC/privacy procedure; historical offline archives require an erasure-aware retention policy. Restoring an archive from before a deletion also needs a durable erasure-ledger replay; only an archive containing the interrupted deletion job has been tested here. Existing web/native deletion wording also needs to distinguish accepted cleanup from completed erasure before this asynchronous path can be released. Pending/uncertain external transfer reconciliation is not a completed erasure guarantee. Large shared child collections/cascade write costs are unqualified. Do not onboard real accounts on the strength of this checkpoint. The 101-save restart test, shared-child mutation checks, actual HTTP revocation probe and coordinated interrupted-job restore prove the tested cleanup and isolation boundaries, not complete legal/privacy compliance or an arbitrary-volume account deletion.

Offline maintenance now reconciles article/briefing receipts with saved rows after every writer is stopped, all ten epochs are locked, and an encrypted archive has been persisted, authenticated and read back. Unreferenced editorial receipts older than one day can retire; recent incomplete saves remain protected. Pins remain when another user references the hash. Permanent betting receipts, betting pins and unrelated operator/legal pins remain protected. Completed acknowledged dispatch intents can retire. No request asynchronously removes a cross-database pin. The 90/30/7/30-day retention policy, original IDs and published/saved history remain unchanged.

Completed odds-processing and handoff roots still require verified compaction that preserves idempotency, attribution and replay behavior. This commit deliberately leaves those conservative roots intact. It does not establish bounded multi-year storage or a complete lifecycle reconciliation PASS. Maintenance remains an owner Node process, not a Worker invocation: its many export/GC queries are explicitly outside the 50-query HTTP budget and outside the daily replay totals.

## Combined scheduler evidence

Reproduce with `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/qualify-rc2-combined-day.ts` with DATABASE_URL absent. Evidence: `reports/rc2/combined-day/combined-schedule.json`. All data and RSS XML are synthetic; actual parsing, automation HTTP routes, durable scheduler, synthesis, publication, correction, private notification dispatch, D1 and scoring code execute in local workerd. Outbound provider traffic is blocked.

| Measurement | Result |
| --- | ---: |
| Teams / active RSS sources | 32 / 97 |
| Virtual duration / local elapsed time | 24 hours / 99.59 seconds |
| Expected / completed source checks | 18,504 / 18,344 |
| Capped 32-call ticks | 19 |
| New stories / corrections | 96 / 96 |
| Followers / briefing publications | 50 / 32 |
| Synthetic odds events / markets per event | 16 / 2,000 |
| Measured fixture requests | 26,432 |
| D1 rows read / written | 537,781 / 77,417 |
| Maximum application statements | 49 |
| Final pending jobs / polling retry inbox | 0 / 0 |
| Source failure checkpoints | 0 |

Setup of 50 synthetic users and RSS fixtures is excluded. Registry refresh retains its 30-minute cadence in separate fixture calls; its burst is not included in the content runner's 32-call cap. Parent cron/service invocation counts and a fully combined delivery/registry/retention schedule are still unqualified. Corrections and odds/scoring use separate bounded requests; odds remain Monday/Wednesday/Saturday. No source interval or NFL team was removed. The burst causes source-check drift despite an empty final backlog: this is **not** proof of cadence/freshness PASS. End-of-day briefing publications are separate fixture invocations, not a qualification of the morning generation/delivery window. Live push/email, real source latency, raw provider capture, HTTP user activity, hosted request accounting/CPU and raw owner maintenance/export operations are not included. Continuation interruption/restart and provider uncertainty remain covered separately by regression tests; this replay does not invent a network-failure rate or measure hosted retry latency.

Subsystem rows written: registry synchronization 1,098; combined polling/editorial/dispatch HTTP 72,343; corrections 3,272; direct odds boards 272; scores 112; briefings 320. Sampled maxima respectively 14, 49, 29, 15, 19, 11. Monitoring adds reads but no writes. Local metadata is reported without an invented index multiplier; hosted indexed write accounting still needs verification.

RC1's mixed replay measured 78,174 writes with an unbounded virtual-minute drain. RC2's 77,417 uses a bounded runner and misses checks; the difference **must not be represented as an optimization gain**. Adding the inherited unmeasured 81 private writes/DAU/day (4,050 at 50 DAU) and the prior 1,125 raw-capture refresh-day estimate gives 82,592 before missing checks, maintenance/export, full delivery and hosted differences. It is only a planning subtotal. Neither the preferred 70,000-write target nor safe worst-case headroom is demonstrated. Additional D1 databases do not add daily operation allowance.

The smallest safe handoff is private synthetic staging with all ingestion/delivery flags and crons disabled; manually admitted bounded jobs may be tested after separate approval. A complete all-team live Free launch is not qualified. Do not compensate by silently dropping teams or relaxing source intervals.

## Private staging package

Five templates: `config/rc2.{password,api,odds-processor,application,web}.toml`. Ten distinct synthetic D1 IDs, role migration directories, static assets behind `run_worker_first`, no R2/PostgreSQL bindings, no workers.dev/preview/public service routes, no crons, all ingestion/delivery flags disabled. The templates intentionally cannot serve a public staging URL before owner configuration.

Generate exact commands without executing remote operations:

```sh
python3 scripts/validate-rc2-config.py
python3 scripts/rc2-staging-commands.py
DD_BUILD_WRANGLER_CONFIG=config/rc2.web.toml node scripts/build-split-worker.mjs
node scripts/prepare-rc2-dry-runs.mjs
```

`reports/rc2/staging-commands.txt` lists database creation, all ten role-specific migration commands, isolated secret uploads and deployment order: password → API → odds processor → application → Web. It is an instruction artifact only; nothing creates or deploys resources automatically. The owner must first verify the actual account's Free plan, ten slots, existing account-wide usage and absence of billing upgrades. Substitute real **staging-only** IDs consistently in every configuration. Never apply the old single-D1 migrations over role schemas. Preserve original databases during rollback.

Cloudflare Access is not onboarded. A documented alternative exists: Cloudflare-managed client certificates on a staging-only proxied hostname, checked in the Worker using trusted `request.cf.tlsClientAuth`, with an individual certificate SHA-256 allowlist. Cloudflare documents client certificate availability on Free and the Worker metadata fields. See [certificate availability/setup](https://developers.cloudflare.com/ssl/client-certificates/create-a-client-certificate/), [Worker certificate metadata](https://developers.cloudflare.com/ssl/client-certificates/client-certificate-variables/), and [Worker enforcement](https://developers.cloudflare.com/learning-paths/mtls/mtls-workers/).

The RC2 Web gate rejects absent, invalid, revoked or non-allowlisted certificates and wrong hosts before assets/API/application dispatch. It never trusts a certificate HTTP header. Set STAGING_MTLS_HOST and STAGING_MTLS_SHA256 only after approved hostname/certificate setup. Each tester installs their own certificate/private key; revoke/remove its fingerprint to withdraw access. End-user authentication remains separate. Missing configuration denies all. Local negative tests pass; account eligibility, hostname mTLS enablement, browser certificate presentation and hosted bypass checks are **unverified**, so this is a prepared alternative, not a claimed live security PASS. Keep internal Worker public endpoints disabled.

Required isolated secrets: AUTH_JWT_SECRET (API and Web), APP_MAIL_ENCRYPTION_KEY, CONTENT_AUTOMATION_SECRET and APP_MAIL_JOB_SECRET where bound. Set staging-only AUTH_BASE_URL in the API/Web environment. Keep provider, email, push and paid-AI credentials absent. Store DD_OFFLINE_BACKUP_KEY outside the repository. Never reuse production secrets. No staging URL exists until an approved hostname is configured.

Health: anonymous and spoofed certificate-header requests, including static assets, must return 403. With a valid tester cert check `/api/auth/config`, synthetic login/logout, all team routes, saves and restart. Use the automation credential plus tester certificate for private `/api/automation/storage-health`; obtain real account-wide reads/writes from Cloudflare analytics, not that endpoint's placeholders. Measure each Worker separately using the built-in CPU-time metrics in the [Workers dashboard](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/); local elapsed time is not Worker CPU. Keep paid Tail Workers/Logpush and persisted log destinations disabled. If invocation logs are separately verified as no-billing for the account, their documented field is `$workers.cpuTimeMs`, not an assumed tail-console timestamp. No observability plan is activated by this package. The existing Argon2 parameters must remain unchanged.

Cloudflare currently documents the shared D1 limits and failure on exhausted Free quotas: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [quota behavior](https://developers.cloudflare.com/d1/reference/faq/), [Workers CPU/request limits](https://developers.cloudflare.com/workers/platform/limits/). Account availability is unverified. The router still reserves at most 50 aggregate statements before execution; the 64 MB encoded-payload admission guard remains unchanged. Atomic commits and conservative pins protect existing records on failure. There is no paid fallback. These guards do not establish an account-wide 70,000-write admission controller or arbitrary saved-collection/cascade bounds; those remain blockers.

Emergency: deny all certificate fingerprints/remove the staging-only Web route, stop ingestion and every writer, leave all cron/feature flags disabled, and reconcile uncertain external attempts before retry. Code rollback uses the reviewed prior Worker version (`wrangler versions list`, then `wrangler rollback VERSION --config CONFIG`) with a compatible coherent schema; never blindly downgrade D1 data. Restore only to new empty isolated databases and switch bindings after verification. Do not point rollback code at production or assume a flag merges shards.

Local recovery commands remain `npx tsx scripts/multi-d1-owner.ts backup|restore|maintain --local PERSIST_DIR ARCHIVE_JSON WRITERS_STOPPED`; restore requires a **new empty** destination. All writers must actually stop; SDK epochs do not stop raw SQL. Existing archive bounds and all-shard authentication remain intact. A daily verified offline backup implies up to 24-hour RPO; hosted RTO is unmeasured. The owner CLI is local-only. A hosted stopped-writer ten-D1 export/import/recovery drill is still required; no executable remote restore is falsely supplied as qualified.

## Final validation

- Full application: **1,079 passed, zero failed, two existing skips**.
- Full Worker/D1 suite: **163 passed, zero failed, zero skipped**. Additional newly added erasure-recovery test: **1 passed**. The full suite includes team routing, editorial, Parlay, retention, recovery and bounded erasure/reconciliation tests.
- Staging mTLS negative/security test: **1 passed**. Total for these automated checks: **1,244 passed, zero final failures**.
- Browser: **48 viewport checks passed**, plus authenticated product HTTP workflows, ownership/restart checks and the real trade HTTP fixture. KC/SEA, desktop/mobile web. These do not establish native device validation.
- Authentication: ten scenarios on actual local workerd with ten physical D1 databases, no DATABASE_URL or R2. Separate erasure HTTP probe verifies unauthorized/origin/confirmation rejection, ignored foreign-user ID, 202 acceptance, immediate revocation, other-user isolation and restart. Final erasure remains unqualified.
- Production build: **95 pages and 200 API routes**, Next/OpenNext and fresh API bundle pass; **five Wrangler dry runs pass**. Both TypeScript project checks pass. Existing Next Edge compatibility/lint warnings remain; they are not deployment or CPU evidence.
- First full Worker run: 162 passed, one authentication startup failure because the fresh worktree lacked its generated API bundle. The full production build fixed that prerequisite; the complete rerun passed 163/163. Initial failure evidence is retained in `reports/rc2/validation/worker-first-run.log`.

Evidence lives under `reports/rc2/`; `validation/summary.json` records release decisions separately from test success. Tests that overwrite earlier milestone reports have their new outputs copied into this directory; the committed earlier reports are restored unchanged. No test was removed or weakened.

## Remaining blockers and next action

Finish reviewed final erasure/anonymization and child-collection write bounds; compact completed processing/handoff roots against verified archives; demonstrate the full scheduling cadence plus delivery and maintenance costs within account-wide quotas; then qualify hosted CPU and coordinated recovery. Local FanDuel/DraftKings routing, original identities, saved evidence and uncertain attempts remain regression-tested with synthetic responses; real transfer/provider entitlement is an explicit staging gate.

Owner actions now: review this local checkpoint. No deployment approval is requested while local release gates fail. Later, verify account headroom/no-billing eligibility; approve isolated resources/hostname/certificates; supply staging-only secrets; authorize a bounded synthetic hosted trial and provider verification separately. Never use real user data for that trial.

**RECOMMENDED NEXT ACTION:** complete the remaining local erasure/lifecycle/scheduler implementation gates before authorizing hosted staging. Do not deploy this checkpoint.

Browser checks cover KC/SEA at 390px and 1440px; no native Android/iOS build or device validation was performed. No shared visual components were changed.
