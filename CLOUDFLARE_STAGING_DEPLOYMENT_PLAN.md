# Cloudflare staging deployment plan

Prepared 2026-10-19 from `poc/d1-migration-completion` / `5bac5bcb`, in isolated worktree `/private/tmp/down-distance-staging-preparation`. **STOP before resource creation or deployment.** No production systems, DNS, real users, provider deliveries, or paid infrastructure were accessed or activated.

> Preflight update: see `CLOUDFLARE_STAGING_PREFLIGHT_RESULTS.md`. Account inspection found Workers Free active, but R2 and Access not enabled. Deployment remains NO-GO.

## Decision and scope

Local preparation is complete subject to the validation results below. Hosted deployment is **not yet authorized or qualified**. The migration report confirms PostgreSQL-free local workflows, while password CPU on Workers Free and sustained storage/operation budgets remain unresolved. A small, private, synthetic staging exercise is appropriate only after account capacity, R2 availability without service activation, and Access configuration have been reviewed. This is not production migration approval.

`scripts/prepare-cloudflare-staging.mjs` generates ignored, machine-specific `.staging/{password,api,web}.json`. It performs no network calls. All Workers initially have `workers_dev=false`, `preview_urls=false`, no custom routes, and explicitly empty Cron Triggers. The application/content scheduler and odds processor are **not deployed** in this first staging exercise. Existing production/local scheduler files remain unchanged. No automatic ingestion, email, maintenance, push fanout, or odds processing is enabled.

## Required isolated resources and routing

| Resource | Name / binding | Purpose |
|---|---|---|
| D1 database | `down-distance-staging-app` / `APP_DB` | Shared by web and API to preserve existing atomic relationships |
| R2 Standard bucket | `down-distance-staging-objects` / `APP_OBJECTS` | Private synthetic immutable payloads |
| R2 Standard bucket | `down-distance-staging-backups` / `APP_BACKUP` | Private synthetic recovery copies |
| Password Worker | `down-distance-staging-password` | Service-binding-only Argon2id; no storage or public route |
| API Worker | `down-distance-staging-api` | Service-binding-only application APIs; `PASSWORD_SERVICE` targets password Worker |
| Web Worker + static assets | `down-distance-staging-web` | `API_SERVICE` targets API Worker; SSR gets the same D1/R2 bindings |
| Hostname-specific Access application | staging web hostname only | Allow explicitly approved testers, deny everyone else |

Use an account confirmed to be on Workers Free with sufficient **account-wide** headroom. Never reuse a production database ID or bucket, even if names seem similar. Review `wrangler whoami` and resource listings manually after authorization; do not automatically choose the first account/database. If the staging names already exist, verify ownership and isolation before proceeding. No bucket public URLs, custom domains, lifecycle deletion rules, or automatic data cleanup are configured.

Planned URL: `https://down-distance-staging-web.<account-subdomain>.workers.dev`. It does **not exist as a verified deployment**. The subdomain/account/database UUID are outstanding operator inputs. API/password have no public URLs. Requests under `/api/` traverse the API service binding; other paths use the OpenNext web Worker. Browser assets use the web asset binding. No production DNS edits are needed.

## Environment and secrets

Generated web/API vars: `APP_DATA_BACKEND=d1`, `APP_RUNTIME=cloudflare`, `INFRASTRUCTURE_COST_POLICY=zero-cost`, `AUTH_BASE_URL` equal to the exact staging HTTPS URL, `PRELAUNCH_MODE=false`, `APP_CACHE_VERSION=staging-5bac5bcb`. All generated `APP_*_ENABLED` vars are false, including password, public caching, content, briefings, odds, mail, maintenance and social notifications. The cost-policy variable is an application preference, **not a Cloudflare billing cap**.

Set independently generated staging-only secrets, never production values:

| Secret | Workers | Requirement |
|---|---|---|
| `AUTH_JWT_SECRET` | web + API | Same high-entropy value on both; at least 32 characters; stage-only cookies/sessions |
| `APP_MAIL_ENCRYPTION_KEY` | API | Independent high-entropy key for encrypted reset/verification outbox payloads |

`DATABASE_URL` and `PRODUCTION_DATABASE_URL` must be absent, along with SMTP/Resend, push, OAuth, Stripe, sportsbook, AI-provider and content-automation credentials. No `AI` binding is included. Live AI search and external integrations are deliberately unavailable. Do not upload a general `.env` file. Supply secrets through interactive Wrangler prompts or approved secret-manager input, never shell history or repository files. The password Worker receives no application secrets.

Authentication has two layers: Access restricts staging entry; application D1 sessions provide separate synthetic-account ownership. Do not change the existing Argon2id parameters (`m=19456,t=2,p=1`, 32-byte hash) or PHC compatibility. Password endpoints remain disabled until a separately approved hosted CPU qualification. Local auth tests explicitly enable them against disposable synthetic D1 and inspect encrypted mail offline. Reset emails must never be delivered. Mail outbox rows may be created; no mail scheduler/provider runs.

## Exact command sequence — FUTURE execution after approval

Run from the staging worktree with the repository-pinned dependencies. `node_modules/wrangler/bin/wrangler.js` was version 4.151.1 during preparation. Commands below that create remote resources, change remote secrets, or deploy have **not been executed**.

First, after authorization for staging resource creation only, confirm account identity and Free plan in the dashboard. Set a staging-scoped `CLOUDFLARE_API_TOKEN` and the reviewed `CLOUDFLARE_ACCOUNT_ID` outside committed files. API token permissions must cover only the reviewed staging account, D1, Workers scripts and R2 resources; do not provide DNS permission. If R2 is not already available and would require service/billing activation, stop and report that blocker.

```sh
node node_modules/wrangler/bin/wrangler.js whoami
node node_modules/wrangler/bin/wrangler.js d1 list
node node_modules/wrangler/bin/wrangler.js r2 bucket list
node node_modules/wrangler/bin/wrangler.js d1 create down-distance-staging-app
node node_modules/wrangler/bin/wrangler.js r2 bucket create down-distance-staging-objects
node node_modules/wrangler/bin/wrangler.js r2 bucket create down-distance-staging-backups
```

Record the returned staging D1 UUID. Replace the two explicit inputs below; the generator rejects the all-zero placeholder UUID. Confirm the UUID against the new database creation result, not just UUID syntax. Generated configs deliberately omit `account_id`, so the reviewed account environment must remain set for every remote operation.

```sh
node scripts/prepare-cloudflare-staging.mjs STAGING_DATABASE_UUID ACCOUNT_SUBDOMAIN
node --test tests/staging/config.test.mjs
node scripts/build-password-worker.mjs
node scripts/build-split-worker.mjs
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/password.json
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/web.json
```

The build script's deploy invocation is also `--dry-run` only. Review all upload sizes, service bindings, bucket names, absence of Cron Triggers, and disabled public routes. No artifact upload occurs during dry-run. Archive the build commit, gzip sizes, configuration hash, migration checksums and approval before proceeding.

After separate approval for remote migration and initial private deployment:

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations list APP_DB --remote --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --remote --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js d1 execute APP_DB --remote --config .staging/api.json --command 'PRAGMA foreign_key_check;'
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/password.json
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/web.json
node node_modules/wrangler/bin/wrangler.js secret put AUTH_JWT_SECRET --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js secret put APP_MAIL_ENCRYPTION_KEY --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js secret put AUTH_JWT_SECRET --config .staging/web.json
```

Keep all public routing disabled while setting secrets. Save the deployed version IDs after secret changes. Set up **hostname-specific** Access for the exact staging web URL (Zero Trust > Access > Applications > self-hosted application); allow only named approved tester identities using an existing identity provider. No bypass or Everyone policy. Avoid account-wide Access changes, which could affect unrelated applications. Do not use email OTP when complying with the no-real-email requirement. If no existing suitable identity provider/Free Access capacity exists, leave routing disabled and stop.

Only after reviewing Access, enable the web route by changing `.staging/web.json` `workers_dev` to true, leaving API/password false, and redeploy **web only**:

```sh
node node_modules/wrangler/bin/wrangler.js deploy --config .staging/web.json
```

Access is a required manual gate; the config generator does not create Access policies or claim to validate remote account state. Test an unauthenticated browser first: it must reach Access denial/login, never application content or `/api/auth/config`. Then use an approved identity to test web/API health. If Access does not protect every path, disable the route immediately. Preview URLs stay disabled. Re-running the generator resets public routing and passwords to disabled.

A subsequent **approved CPU canary** may set `.staging/api.json` `vars.APP_PASSWORD_ENABLED` to `true` and redeploy API, still behind Access, for a few synthetic registration/login/reset requests. Measure the password service separately. If it exceeds Free CPU limits, disable it again and report a blocker; do not weaken hashing or activate Workers Paid. This qualification is required before calling staging authentication ready.

## Validation performed locally

Results and command evidence are in `reports/staging-deployment/`. All test execution used local workerd/Miniflare or offline tests. The auth/browser runners construct whitelisted environments, explicitly assert both PostgreSQL URLs are absent, block external provider traffic, and use disposable synthetic accounts/storage. No Cloudflare account was inspected.

- All 38 additive D1 schema migrations applied using the **generated staging API config**, fresh local persistence. No PostgreSQL migrations were deleted or changed.
- `PRAGMA foreign_key_check` returned no violations through local D1. Direct read-only SQLite `integrity_check` returned `ok`; application DB has 171 SQLite tables including internal/FTS tables and 500 × 4096-byte pages (2,048,000 bytes, 1.95 MiB). This is empty-schema size, not annual workload storage. Workerd rejects some introspection PRAGMAs with SQLITE_AUTH, so physical page/integrity checks were performed offline; they are not remote D1 measurements.
- Generated graph isolation/configuration tests and password/API/web `deploy --dry-run` checks: see final validation summary below.
- Application bundle artifacts were cloned from the exact unchanged baseline build to avoid rebuilding unrelated application code; generated staging configs were bundled again locally. No application behavior or UI was modified.

| Validation | Current result |
|---|---|
| Application/offline regression | **1,065 passed, 0 failed, 2 skipped**, including the 2 new config tests |
| Worker/D1 integration and recovery | **119 passed, 0 failed** |
| Desktop/mobile-web critical browser routes | **48 passed, 0 failed**, plus 12 HTTP workflow contracts |
| Real Trade Machine HTTP regression | **1 passed, 0 failed**, run separately by browser harness |
| Actual local workerd authentication | **PASS**, registration/login/PHC/reset/session expiry/concurrent sessions/logout/restart |
| Generated staging graph checks | **2 passed**, included in application total, not an additional 2 |
| Generated staging dry-run bundles | **PASS**, gzip web 2,338.34 KiB, API 898.15 KiB, password 79.42 KiB; gzip values retained as baseline measurements; current limit is 64 MiB uncompressed |
| Hosted CPU / account quotas / Access | **NOT VERIFIED**; no remote access |
| Throttled performance harness | Syntax checked; **not measured** in this task |

The two application skips are the PostgreSQL-only sportsbook fixture and Trade Machine HTTP test requiring its real server; the latter passed separately against local Workers. Counts are separate test categories, not a sum of independent product workflows. Existing application test count was 1,063; the two new staging config tests make 1,065. Raw runtime logs that print synthetic configuration were excluded from committed evidence; results, route timings, screenshots, schema checks and test summaries are retained. Reproduce from the worktree:

```sh
node --test tests/staging/config.test.mjs
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
node scripts/probe-staging-auth.mjs
D1_BROWSER_REPORT_DIR=reports/staging-deployment/browser node scripts/validate-d1-browser.mjs
```

All commands above run locally; browser/auth runners require the built split Worker artifacts. PostgreSQL is absent from their child environment.

## CPU instrumentation and usage monitoring

The configs enable observability at 100% sampling for the small controlled exercise. Keep test volume low and disable/reduce logs after qualification. Existing `application_headers` JSON logs record route family, status, wall milliseconds, D1 statements/rows and R2 reads/writes; they intentionally report `cpuMs:null`. Neither local `performance.now()` nor browser timing measures hosted Worker CPU. Password payloads, PHC hashes, cookies, reset tokens, and secrets must never be logged. Inspect/redact request URLs before retaining raw platform tail logs.

After deployment approval, collect platform CPU Time per execution for **each** staging Worker in Workers dashboard > Metrics. Separate cold/warm SSR, API reads/writes and Argon2 hash/verify; record p50/p95/p99, errors/exceeded-resources, sample counts, Worker version, region and time range. Supplement with invocation trace `CPUTimeMs` where available. `wrangler tail --format json --config .staging/api.json` (and web/password separately) is a diagnostic stream; do not assume every tail payload exposes CPU or that sampled metrics are a complete audit. No CPU acceptance claim until platform data exists. Do not rely on occasional CPU rollover to pass 10 ms sustainably.

Record dashboard account usage before the bounded run, after migration, after each workflow group, and the next UTC reset. Use D1 Metrics Row Metrics and DB size (all tables/indexes), R2 bucket Metrics plus account storage/Class A/Class B totals, Workers total requests and Logs ingestion. Sum across **all account resources**, including unrelated workloads. Application counters omit control-plane operations, failed/retried operations and other clients; use account billing metrics as authority. Migrations, index maintenance, backups and restores consume quotas too. No new D1 telemetry table, telemetry bucket, analytics service, or recurring monitor was added.

Proposed staging stop budgets, contingent on existing headroom: 1,000 Worker invocations/day across the staging chain, 100,000 D1 rows read/day, 10,000 written/day, D1 <100 MiB, R2 <250 MiB combined staging buckets, 10,000 Class A and 50,000 Class B per month. These are **operator stop thresholds**, not enforced billing caps or guaranteed bounds per browser run. Count fanout/service invocations conservatively and stop before thresholds. Check counters between small test groups, not only at run end. No unattended load generator or scheduler.

## Expected free-tier usage and unresolved capacity

Cloudflare documentation checked 2026-10-19:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free 100,000 requests/day, 10 ms CPU/request. Current documentation specifies a 64 MiB uncompressed script limit with no compressed-size limit; the earlier 3 MiB reference is superseded. Check every split Worker independently, including Wasm. Proposed staging request budget uses at most 1% before other account use.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/): account-wide 5M rows read/day, 100k written/day, 5 GB total storage, with 500 MB per Free database. Extra databases do not add daily writes. Proposed staging daily row budgets use 2% reads/10% writes before other use; migrations are additional. Index writes count. Observed local empty schema is ~2 MB; populated staging growth must be measured.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard free allowance 10 GB-month/month, 1M Class A/month, 10M Class B/month across account usage. Proposed staging operations use 1%/0.5% respectively; 250 MiB kept for a full month is approximately 0.262 GB-month. R2 is metered beyond allowances; alerts are not a hard spending cap. No Infrequent Access or paid add-ons.

These staging budgets are conservative operating limits, **not measured usage predictions**. Browser actions can fan out; observed unit counters and hosted account totals must determine the actual run size. Account headroom is unknown because no account access occurred. Prior production reports project ~829 MB D1/year and storage workloads outside qualified R2 capacity (the reported 51.5 GB/year backup workload has not been requalified by this preparation). Synthetic staging with ingestion disabled does not resolve those production blockers or establish $0 sustainability. No new broad capacity audit was performed.

## Browser and mobile performance qualification

`scripts/validate-d1-browser.mjs` now accepts `D1_BROWSER_REPORT_DIR`, preserving previous report evidence while saving new isolated-run results. It runs actual local web/API/password Workers and desktop/mobile-web smoke checks, two team themes, authentication ownership, Front Office, Parlay Lab, editorial and other critical workflows. It does **not** target remote URLs.

`scripts/measure-staging-performance.mjs http://localhost:8787` is prepared for a separately running local split Worker on port 8787. It refuses non-local URLs, blocks cross-origin requests, measures navigation TTFB, LCP, cumulative layout shifts and JS transfer size; desktop 40 ms/10 Mbps and mobile-web 150 ms/1.6 Mbps with 4× CPU throttling. It records redirects/status instead of claiming an authenticated protected page was measured. It is a smoke measurement, not field Core Web Vitals qualification. INP remains null until representative trusted interactions are implemented. AI Search overlay, Trending Props, Bet Slip, filtering and authenticated app interactions need dedicated hosted scripts/fixtures; do not infer their performance from navigation timing.

For the approved hosted run, use a separate Access-authenticated browser context with synthetic application accounts. Reuse the tested canonical routes (`/`, `/the-beat`, `/watch`, `/three-and-out`, `/huddle`, `/front-office`, `/parlay-lab`, `/account`) and capture cold/warm samples on mobile and desktop under the same throttles. Verify no private response is publicly cached; cache is disabled initially. Compare only equivalent network/data/auth states. Measure API p95 separately from full page time and hosted CPU. Targets (mobile LCP <1.5 s, INP <200 ms, CLS <0.1, geographically realistic cached API p95 <100 ms) are not proven here.

Native Android/iOS remain React Native and were not built or device-validated in this task. Before device testing, configure a staging API origin in a separate native development build and a reviewed Access-compatible identity path; do not point released applications at staging or embed Access service secrets in mobile bundles. Test startup, tabs, transitions, token expiry and background refresh with synthetic data. Native Access authentication remains an integration blocker. Browser viewport tests are not native device validation.

## Rollback and recovery

Before each approved deployment record `wrangler deployments list --config .staging/web.json`, and the equivalent API/password versions; save configuration and secret-version references securely. Preserve the original migration files and raw synthetic recovery archives. Freeze writers and stop test clients before any data rollback.

For a code regression, first disable web `workers_dev` and redeploy web if exposure is unsafe. Then use `node node_modules/wrangler/bin/wrangler.js rollback PREVIOUS_VERSION_ID --config .staging/api.json` (and web/password as needed), choosing mutually compatible versions. [Worker rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) does not restore database content, bucket objects, external bindings or arbitrary secrets. On the first deployment there is no previous version: leave the staging route disabled, preserve storage, and prepare a corrective private deployment. Never delete the database/buckets to simulate rollback.

Schema migrations are additive: do not down-migrate populated tables. For data damage, keep sources intact, freeze writers, create a **new isolated staging recovery database and buckets** after approval, and restore a matched D1/object snapshot through the existing synthetic recovery tooling. Verify manifest digests, complete R2 object coverage, original IDs, foreign keys, row counts, owner isolation, saved links, Front Office command replay and editorial historical resolution. Run smoke tests against the private restored target before reviewing a rebind. Do not use D1-only Time Travel to claim R2 consistency. Do not toggle to PostgreSQL with stale data; reverse replay of new D1 writes is not implemented.

Staging objective: manually checkpoint before every mutable test group; RPO is the last verified checkpoint (no automatic daily guarantee), RTO target 60 minutes but **unmeasured hosted**. Existing synthetic recovery tests are rerun in Worker qualification; they do not establish a hosted full-scale recovery SLO. Existing snapshot tooling has size/streaming and writer-freeze limitations documented in `STAGING_READINESS_REPORT.md`; keep fixtures small and stop if exceeded. No retention deletion is enabled. After review, synthetic-only cleanup can be separately authorized; existing editorial/user data must remain untouched.

## Remaining blockers / review checklist

1. Remote account identity, Workers Free status, unused account quotas, existing R2 availability, staging UUID and account subdomain not yet verified; no remote resources created.
2. Access policy, suitable existing identity provider and hostname protection must be configured and tested before enabling a route. Do not modify account-wide routing/security.
3. Hosted Argon2id and SSR CPU qualification; password defaults disabled. Full staging authentication cannot be claimed ready yet.
4. Production storage/read/write/backup capacity remains unqualified; small staging usage is not production free-tier proof.
5. Hosted end-to-end recovery, native Access/API flows, performance targets and live-provider integrations remain unverified. All provider ingestion/delivery/payment/push activity remains off.
6. Hosted secrets, browser-safe staging auth, post-deployment health/ownership checks and explicit deployment approval are required. No production cutover or user import is part of this plan.

**Review stop: no deployment, cloud resource creation, remote migration, DNS change, paid service activation, or real email has been performed.**

## Final sprint additions (not deployment authorization)

See `FINAL_CLOUDFLARE_STAGING_READINESS.md` for the application-level signed Access JWT gate, static asset dispatch protection and offline deployment guard. Generated staging web now runs `workers/staging/index.ts` before assets. Configure the reviewed Access team domain and application audience; empty values deliberately deny all traffic. Before an initial private deployment, pin `account_id` in every config and validate a fresh operator receipt with `node scripts/staging-deployment-guard.mjs .staging/account-receipt.json`. The receipt is operator evidence, not an independent remote verifier. That command only writes reviewable commands and never executes them. The account's R2/Access prerequisites and deployment approval remain unresolved.
