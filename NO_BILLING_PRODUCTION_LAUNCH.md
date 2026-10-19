# Down & Distance — no-billing launch assessment

Baseline: `935d3e91`, isolated worktree `/private/tmp/down-distance-staging-preparation`, branch `poc/no-billing-production-launch`. Prepared 2026-10-19. **NO-GO for a complete production launch.** Removing the mandatory R2 binding is implemented; fitting the full retained workload and qualifying external services remain unresolved. No production/account access, remote resource creation, deployment, paid activation, real email, or user-data deletion occurred.

| Required result | Status |
|---|---|
| R2 required | **NO** for the new application D1 payload configuration; legacy R2 POC tools remain optional |
| PostgreSQL required | **NO** in tested local D1 workflows; rollback adapters/history retained |
| Free-tier capacity at 25 DAU | **NOT QUALIFIED**; approximately 5.849 GB annual demand, before unknown domains |
| Free-tier capacity at 50 DAU | **NOT QUALIFIED**; approximately 5.873 GB annual demand, before unknown domains |
| Authentication | Local workerd PASS, existing Argon2id PHCs preserved; hosted 10 ms CPU fit unknown |
| Database | Additive migration 0039, D1-only immutable payload adapter; capacity refusal rather than deletion |
| Backups | Encrypted owner-operated logical export/restore PASS; owner execution and separate key custody required |
| AI | Real inference NOT qualified; no paid fallback or mandatory AI binding added |
| Email | Delivery remains disabled; encrypted reset queue works locally, delivery/account allowance unverified |
| Parlay Lab | Existing local browser/API and regression contracts exercised; real sportsbook access unverified |
| Tests passed / failed | 1,194 automated passes, 0 final failures; 2 existing skips; 48 browser routes passed |
| Ready for staging | **NO** for a complete private hosted environment; offline/local validation is available |
| Ready for production | **NO** |

## Implementation and R2 inventory

`packages/storage/d1-objects.ts` implements the existing Objects interface. API, SSR, application scheduler and odds processor select it with `APP_OBJECT_BACKEND=d1`; no R2 binding is required in this mode. Unknown backends fail closed. The existing R2 adapter/configuration remains for rollback. Migration 0039 adds payload manifests, ordered base64 chunks and one capacity counter; original user IDs, content hashes, foreign keys, heads and command receipts are unchanged.

Raw objects remain capped at 4 MB, use existing optional gzip and SHA-256 verification, and are read back before application heads commit. Physical chunks contain at most 48,000 bytes (64,000 base64 characters), below D1 row/string limits. Worst-case 4 MB objects use 84 chunks, written eight rows per INSERT (at most 24 bindings and 512 KB encoded body per statement), in batches of at most 40 statements. A maximum-size object uses 11 chunk INSERT statements, keeping an individual payload operation below the Free 50-query invocation allowance; complete route-level amplification still needs hosted qualification. Concurrent admission uses a transactional counter, not a scan over all payloads. Retries deduplicate; partial writes retain reservations and remain unavailable until completion. There is no automatic garbage collection, and capacity is never reclaimed by deleting required history.

Encoded payload reservations stop at 64 MB. This is **not** a total database ceiling: base64 costs 4/3, plus SQLite pages, manifests and structured tables. Incomplete/unreferenced uploads consume the reservation too. Exhaustion explicitly fails writes; it is a launch blocker, not a sustainable retention solution. Existing rows are retained. A compression-buffer bug for maximum-size incompressible input was fixed without increasing the raw/decompressed object limit.

| R2 use | Classification | No-billing treatment |
|---|---|---|
| User/Front Office aggregates, command responses, preferences, saved metadata | Essential transactional data | Immutable D1 payloads, existing transactional heads/receipts |
| Editorial versions, original evidence, source attribution, Three & Out and historical directories | Essential historical data | D1 payloads; retained, not silently dropped |
| Saved betting evidence, original market identities and odds referenced by saved records | Essential historical/transactional data | Preserved through the same storage interface |
| Computed odds boards, Lab Scores and AI cache results | Reconstructable data | D1-backed; existing derived-key expiry retained; immutable payload GC is NOT implemented |
| Consumed token archive, job/outbox history, orphan payloads | Temporary/operational data | Existing verified archival semantics retained; no blanket destructive TTL |
| Fonts, logos, scripts, images bundled with the app | Static application assets | Existing Workers Static Assets; mutable/private uploads remain private D1 payloads and bounded |
| Second R2 copies, daily/weekly recovery checkpoints | Backup/recovery data | No mandatory scheduled cloud copies; D1 Time Travel plus owner-managed encrypted offline exports |
| `content-engine` lean/R2 archive experiments and recovery benchmarks | Optional historical POC tooling | Retained as rollback/research tools; excluded from new runtime bindings |

No UI/native behavior was replaced and no feature was silently hidden. AI and real email remain explicitly unresolved rather than represented as working paid-service-free features. Unlimited required historical archives cannot safely be converted into bounded D1 retention. The remaining storage gap is reported, not concealed with deletion or sampled history.

## Recovery

D1 Free provides **7 days of Time Travel**, at most **10 restores per 10 minutes per database**. This is short-term provider recovery, not an independent off-account backup. See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). Actual remote restore was not invoked.

Offline objective: daily frozen export, **RPO at most 24 hours only if the owner actually runs and verifies it daily**; keep seven daily and four weekly encrypted copies on owner-managed media, with a second offline copy. Production RTO is unmeasured. Stop every writer (API writes, scheduler, ingestion and owner imports), drain outstanding work, then export. A mere maintenance banner is insufficient. Stopping all writers is an operational prerequisite, not implemented remote automation.

Wrangler's native local export rejects this schema's FTS5 tables. `scripts/export-no-billing.mjs` exports logical tables, FTS content and explicit indexes, excluding SQLite/FTS shadow/provider internals. `scripts/no-billing-backup.mjs` uses random-IV AES-256-GCM, a separate 32-byte key, authenticated decryption and exclusive mode-0600 output creation. Keep keys outside the repository and separate from backups. The logical exporter requires frozen writers; it is not a concurrent snapshot tool. Schema migrations, SQL exports and decrypted restore files are sensitive.

Owner commands, **prepared only; no remote command was run**:

```sh
# First stop ALL writers and choose a protected, owner-managed backup directory.
# --remote requires explicit owner acknowledgement and is NEVER used by local tests.
DD_OWNER_READ_ONLY_EXPORT=I_HAVE_STOPPED_ALL_WRITERS node scripts/export-no-billing.mjs --remote .staging/no-billing/api.toml /OWNER_BACKUP/frozen.sql OFFLINE_WRITERS_STOPPED
node scripts/no-billing-backup.mjs encrypt /OWNER_BACKUP/frozen.sql /OWNER_BACKUP/daily.enc /OWNER_KEYS/backup.key
# Restore only into a NEW, unserved database; never import over an existing target.
node scripts/no-billing-backup.mjs decrypt /OWNER_BACKUP/daily.enc /OWNER_RESTORE/frozen.sql /OWNER_KEYS/backup.key
node node_modules/wrangler/bin/wrangler.js d1 execute APP_DB --local --config wrangler.api-no-billing-local.toml --persist-to /OWNER_RESTORE/fresh-local --file /OWNER_RESTORE/frozen.sql
```

Create the backup key once from 32 cryptographically random bytes on owner-managed storage. Verify decryption and complete row/object/FK/search checks before considering a backup usable or clearing plaintext under an owner-approved process. Do not run migrations before importing the full schema SQL into the fresh target; the export contains the schema. Provider migration ledgers are intentionally excluded: reconcile migration 0039 as baseline before subsequent migrations. Never blindly reapply initial CREATE TABLE migrations onto an imported database.

Synthetic recovery checks exact logical table contents, FTS query recovery, FK integrity and encrypted tamper rejection. Original IDs and payload references remain byte-preserved. This does not validate production-scale RTO, owner key loss, daily owner compliance, offsite media reliability, compromised account recovery or interrupted remote export. Old generic cold-checkpoint tooling has a 64 MB logical snapshot ceiling; it is not the new full database SQL export process.

## Verified limits and capacity assumptions

Official documentation checked 2026-10-19: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Workers Free: 100,000 dynamic requests/day, 10 ms CPU/invocation, 128 MB memory, five Cron Triggers; Static Assets requests are free and unlimited when served without invoking a Worker. D1 account-wide: 5 million rows read/day, 100,000 rows written/day, 5 GB total, 500 MB/database, ten databases. Additional databases do not add daily operation allowances. Writes to indexes also count. These are published limits, **not newly verified account headroom**.

Historical preflight found Workers Free and no R2 activation. No current account access was performed here. The new templates contain no R2, AI, queues, KV, Hyperdrive, Durable Objects, billing subscription or resource-creation commands. Configuration alone cannot prevent an account owner subsequently upgrading a plan; retain Workers Free and do not add billing products. Quota exhaustion must cause failure rather than paid fallback.

Run `python3 scripts/project-no-billing.py` to reproduce `reports/no-billing/capacity.json`, including 30/90/180/365-day rows. This extrapolates the inherited 100/500-DAU affine model down to 0/10/25/50/100 DAU, keeping the fixed ingestion intercept. It is a sensitivity model, not observed user traffic. It removes all cloud backup directories, assumes one copy of the two-copy compressed payload envelope, then adds base64 and a 20% page reserve. Unknown media/source/crew/operational volumes are not assigned zero usage. Source-model rounding contributes negligible arithmetic noise but workload uncertainty is substantial.

| DAU | Dynamic requests/day | D1 reads/day lower bound | D1 writes/day lower bound | Annual D1 demand without admission cap |
|---:|---:|---:|---:|---:|
| 0 | 8,034 | 1,954,487 | 71,467 | 5.824 GB |
| 10 | 8,611 | 1,961,193 | 71,740 | 5.834 GB |
| 25 | 9,475 | 1,971,250 | 72,147 | 5.849 GB |
| 50 | 10,916 | 1,988,013 | 72,827 | 5.873 GB |
| 100 | 13,798 | 2,021,539 | 74,185 | 5.923 GB |

The operation estimates add a minimum five D1 writes and eight rows read per newly created payload; large chunks, retries, indexes and repeated reads can increase them. They are lower bounds, not evidence of 30% headroom. The adapter's initial counter creation adds a first-write operation. No extra daily export costs are credited; owner exports also consume D1 reads remotely. Runtime instrumentation now includes payload SQL in D1 metrics and reports zero R2 operations in D1 mode.

**First known capacity stop:** the 64 MB encoded-payload admission budget would be consumed in roughly seven days under this inherited workload, including at zero DAU. Without that safety stop the annual storage demand exceeds even the account's 5 GB Free total. This model does not certify that every payload is essential; separating eligible reconstructable payloads and proving reference-safe deletion remain necessary. Simply adding D1 databases does not solve the retained footprint or CPU qualification.

AI assumption: 200 shared generations/day, 2,756 input and 700 output tokens, roughly 7,000 neurons/day under the inherited pricing rates; real model/output costs are unverified. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) provides 10,000 free neurons/day, with [model-specific paid-plan restrictions](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/). No AI binding is included, and AI Search inference cannot be declared complete from mocks or search-page rendering.

Email assumption: ten transactional messages plus 10% of DAU/day (10/11/13/15/20 for 0/10/25/50/100 DAU). [Resend Free](https://resend.com/blog/new-free-tier) advertises 100/day and 3,000/month; account/domain eligibility and a hard no-charge policy are unverified, so no delivery is enabled. Password reset tokens were recovered from the encrypted queue only in isolated tests.

Sports assumption: maintain Monday/Wednesday/Saturday odds refresh, 780 reserved objects per 31 days in the inherited pagination envelope; at least three refresh HTTP calls/week, actual pagination and provider quotas unknown. The inherited 780-object monthly reservation envelope also exceeds the existing 700-object application safety cap; refreshes must fail closed rather than raise that cap without verified provider entitlement. Source ingestion fetches and provider plan availability remain unqualified. Worker CPU is **unknown**: local elapsed time is not hosted CPU, particularly Argon2, gzip, SSR and 4 MB object hashing. Request/operation arithmetic alone cannot establish a usable Free launch.

## Deployment preparation, not authorization

```sh
node scripts/prepare-no-billing.mjs
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --local --config wrangler.api-no-billing-local.toml --persist-to /private/tmp/dd-no-billing-review
node scripts/build-split-worker.mjs --api-only
DD_NO_R2=true DD_AUTH_REPORT_DIR=reports/no-billing node scripts/probe-staging-auth.mjs
DD_NO_R2=true D1_BROWSER_REPORT_DIR=reports/no-billing/browser node scripts/validate-d1-browser.mjs
```

The generator writes ignored `.staging/no-billing/{password,api,web}.toml` review templates with distinct staging service names, no public workers.dev/preview URLs, and intentionally invalid database/hostname placeholders. No remote resource IDs are invented. Local no-billing configs include D1 and Static Assets only, plus existing internal password/API service bindings. Scheduler/odds local alternatives are `workers/application/wrangler.no-billing.toml` and `wrangler.odds-no-billing.toml`; scheduler Cron list is empty. The three-times-weekly odds cadence is retained in code, never increased. Production ingestion, mail delivery and external providers remain disabled pending qualification, rather than assumed operational.

Required isolated secrets: AUTH_JWT_SECRET, APP_MAIL_ENCRYPTION_KEY, separate offline backup key; future automation CONTENT_AUTOMATION_SECRET only after qualification. Set AUTH_BASE_URL to the approved HTTPS staging origin; no production secrets, DATABASE_URL, paid API keys or R2 credentials. Password service remains internal; APP_PASSWORD_ENABLED=true uses the strong existing parameters. Private staging still needs a verified access-control gate before any route or asset can be published. The public-web template is not itself an Access policy. No staged hostname is currently available.

After blockers are resolved and deployment is expressly approved, a reviewer would supply a genuinely isolated D1 UUID, remove local-only resource settings in reviewed copies, verify the account is still Workers Free and all bindings belong to staging, provision only authorized Free resources, then run migrations before deploying password → API → web. Prepared command shapes (not executed):

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --remote --config .staging/no-billing/api.toml
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/no-billing/password.toml
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/no-billing/api.toml
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/no-billing/web.toml
```

Health checks: `/api/auth/config`, anonymous `/api/auth/me` must reject, public homepage/Beat/Film Room must render, authenticated save/reload must survive restart, and `PRAGMA foreign_key_check` must be empty. Verify private responses are no-store and cross-owner reads rejected; monitor per-request D1 metadata, database bytes and hosted CPU via provider analytics. Do not interpret `cpuMs:null` as zero. Alert at 70% daily quota and payload reservation, and stop ingestion before exhaustion.

Rollback: stop writers; retain old deployed version identifiers before release; use `wrangler rollback VERSION_ID --config REVIEWED_CONFIG` for each previously deployed Worker. New additive tables can remain. Rolling back to the R2 adapter after D1-only writes requires a verified payload copy/backfill; simply switching the variable would strand new payloads. PostgreSQL rollback similarly requires reconciliation of new writes, not just a DATABASE_URL switch. Restore backups only into a fresh unserved database, verify hashes/IDs/FKs/search, then explicitly switch reviewed bindings. Never drop the original database or migration history.

## Validation and remaining work

Evidence is isolated under `reports/no-billing/`. Local workerd tests explicitly omit DATABASE_URL and R2 bindings. External network/provider calls are blocked. Browser checks use installed Chrome, desktop 1440×1000 and mobile viewport 390×844, KC and SEA; these are not Android/iOS device tests. No shared UI was changed and no native builds were performed.

Validation results:

- Root automated suite: **1,072 passed, 0 failed, 2 existing skips**, across 242 test files. Skips are PostgreSQL-only sportsbook fixtures and the HTTP-only Trade Machine harness; the latter is exercised separately by the actual Worker browser run.
- Worker/D1 regression suite: **122 passed, 0 failed**, including archive/restore, corrupt/missing recovery chains, original IDs and additive migrations. An intermediate run found three recovery failures from a newly seeded capacity row; lazy transactional initialization fixed them without weakening fresh-target checks.
- R2-free targeted suite: **2 passed**, including missing buckets, persisted account/original payload ID, duplicate writes, maximum 4 MB high-entropy input, 84 chunks, SHA-256 verification, corruption rejection, restart and capacity refusal; scheduler dispatch/outbox/observer contracts also pass. The maximum-payload measurement is **7 D1 calls, 19 statements, 90 rows read, 87 rows written** locally. These are D1 metadata, not hosted CPU.
- Actual local workerd authentication: **10 scenarios passed**, including native PHC verification, reset and single-use enforcement, expiry, concurrent sessions, owner logout isolation and restart. Additional Three & Out preference/channel eligibility checks pass. No real email was sent.
- Chrome browser: **48 routes passed**, plus **12 HTTP/product checks**, including a real authenticated Trade Machine HTTP regression, profiles/preferences/saved IDs, Trivia, private ownership and restart. Homepage, Beat, Film Room, Three & Out, Huddle, Front Office and Parlay pages are included; AI Search returned HTTP 200 through its existing evidence/deterministic path with no paid provider; that is not proof of model inference.
- Full encrypted synthetic recovery: PASS with original users/password metadata/sessions/preferences/saved bet/Front Office progress/FTS/payloads, exact logical table comparison, zero FK violations and tamper rejection. Export encryption: 77,552 bytes versus 77,513 SQL bytes in this small fixture; not a production-size estimate.
- Migration repeatability: **39 applied**, second application had no pending migrations, zero FK violations. TypeScript PASS; API-only split Worker build PASS. Existing baseline web assets were reused, and the current web wrapper ran in local workerd. No claim of a fresh complete frontend rebuild.

The full suite uses optional R2 fixtures to retain rollback coverage; only the explicit no-billing runtime, browser, auth and targeted tests prove R2-unavailable operation. The failed native export/initial backup command attempts were replaced by the tested FTS-aware export, not counted as successful backup tests. Known limitations remain: real AI inference, email delivery, sportsbook entitlement/refresh, full source ingest volumes, hosted CPU/memory/startup, private staging gate/account verification, production-scale recovery RTO, durable owner backup operation, and safe reference-aware compaction sufficient to retain essential history. No sustainable complete 25–50 DAU no-billing launch is established. Review these gaps before approving any deployment; do not activate R2 or paid infrastructure as a fallback.
