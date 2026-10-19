# Cloudflare staging preflight results

Date: 2026-10-19. Baseline: `poc/cloudflare-staging-preparation`, `2d65c390`. Worktree: `/private/tmp/down-distance-staging-preparation`.

**Final decision: NO-GO.** The account supports Workers Free and has ample observed Worker/D1 capacity, but **R2 is not enabled and Cloudflare Access is not enabled**. The proposed private D1 + R2 application cannot be deployed as specified without account setup that was deliberately not performed. No application changes are needed to explain these account blockers.

| Required result | Finding |
|---|---|
| Cloudflare account access | **PASS, read-only inspection completed** through existing Wrangler OAuth and existing Chrome dashboard session |
| Free-tier headroom | **Workers/D1 verified at inspection time; R2 unavailable** pending subscription; no blanket free-tier guarantee |
| Cloudflare Access protection | **BLOCKED:** Access API says not enabled; dashboard requires Zero Trust setup |
| Staging resource isolation | **PASS for local design; remote identity/collision verification remains a deployment gate** |
| Required secrets | Staging-only JWT and mail encryption secrets specified; **not created or uploaded** |
| Expected staging cost | **$0 incremental during this read-only preflight. Future staging cost not guaranteed:** R2 requires a metered subscription with possible overages |
| Remaining blockers | R2 subscription, Zero Trust/Access onboarding and policy, suitable login identities, secret provisioning, hosted CPU qualification |
| Deployment recommendation | Keep all staging routes disabled; resolve account prerequisites with owner review, then reassess for a bounded private canary |

## Account evidence and actual headroom

Authorized account: `6e8c301360ab628706dcf3acf55f0dbb`; Workers subdomain `tdingman5.workers.dev`. Sources: live Cloudflare dashboard and read-only API metadata in `reports/staging-preflight/account-metadata.json`. Existing resource source code, secrets, database contents, ingestion endpoints and live application endpoints were not accessed or invoked. The initial sandboxed identity request failed to refresh; retry with authorized network access succeeded. A Python API attempt failed certificate validation; verified Node TLS was used instead, without disabling TLS verification.

The OAuth token can list Workers/D1. Subscription API and Access organization API returned authentication errors; those errors are not evidence of a Free plan. The existing authenticated browser independently confirmed the plan and billing state. No credentials are committed. Missing Wrangler `k2.read`/`k2.write` scope warnings are unrelated to this staging design; no permission expansion/login flow was performed.

| Item | Account observation | Remaining capacity / consequence |
|---|---|---|
| Workers plan | Workers plans: **Free — Current plan**; Billing subscriptions: **Workers Free — Active** | No Workers Paid subscription activated |
| Worker count | One existing Worker, `dnd-content-scheduler`; proposed staging names do not collide | 99 slots before staging against documented Free limit 100; 96 after adding three, if unchanged |
| Requests today | Workers dashboard: **3 / 100,000** | **99,997 requests** remaining at observation, shared account-wide; recheck immediately before any run |
| October 1–19 Workers totals | 144 requests; **108.29 ms** total CPU; Observability events **0**; Workers build minutes **0** | Historical aggregate CPU is not a transferable CPU balance or staging p95 |
| CPU per invocation | Plan UI: **up to 10 ms per request**, matching official limits | Staging SSR and Argon2id hosted CPU remain unmeasured; no monthly CPU bank exists on this Free plan |
| D1 databases | API complete list: **0**, dashboard **0 / 10** | 10 slots before staging; one staging DB leaves nine |
| D1 storage | Dashboard **0 B / 5 GB** total; **0 B-mo** daily metered storage | 5 GB account allowance unused at observation; each new Free DB still limited to 500 MB |
| D1 daily rows | Dashboard since midnight UTC: **0 / 5M read**, **0 / 100k written** | Full daily account allowances unused at observation; index and migration writes count |
| Cron Triggers | Existing scheduler has one schedule: `0 0,2,12,14,16,18,20,22 * * *` | One trigger, not eight; four of five Free trigger slots remain. Proposed staging adds **zero** |
| R2 | API 403, code **10042**, “Please enable R2 through the Cloudflare Dashboard”; browser opens **Get started with R2** | Storage/operation allowance is **not provisioned/usable** for staging; do not label it 10 GB of available account headroom |
| Access | Apps and IdP APIs: `access.api.error.not_enabled`; Workers page: “Set up Zero Trust before requiring Access sign-in” | No staging Access policy, organization or verified identity-provider path exists |
| Billing | Subscription page shows only Workers Free; **No payment method on file** | Not proof of a future spend cap; no payment details, subscription or terms were submitted |
| R2 overage offer | Checkout view: due now **$0**, monthly **$0 + additional usage**, automatic renewal and usage billing terms | Standard overages displayed: $0.015/GB-month, $4.50/M Class A, $0.36/M Class B. **Add subscription was not clicked** |
| Usage notifications | Billing offers configuration of a usage notification; no hard spending cap verified | Notifications do not stop consumption. No alert/email was configured or sent |

These are point-in-time readings, not reservations. The existing scheduler continues to consume account resources independently; it was left unchanged. A Workers list card showed recent errors, but investigating or fixing that existing service is outside this preflight. No production Cron Trigger was enabled, disabled or edited.

Current official documentation:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): 100k daily requests, 10 ms CPU/invocation, 100 Workers, five Cron Triggers, 128 MB memory. **Correction to the earlier plan:** the current page specifies **64 MiB uncompressed Worker size and no compressed-size limit**; gzip is informational. Startup limit remains one second. Hosted deployment/startup acceptance is still unverified.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): shared account daily reads/writes and storage accounting. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): ten Free databases, 500 MB/database, 5 GB total, seven-day Time Travel. Additional databases do not add write allowances.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard includes 10 GB-month, 1M Class A and 10M Class B monthly across the account; excess is billable. [R2 setup](https://developers.cloudflare.com/r2/get-started/) requires subscription checkout. Included usage is not an enabled service or a hard cap.
- [Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) supports protecting the exact `workers.dev` hostname. [Zero Trust setup](https://developers.cloudflare.com/cloudflare-one/setup/) requires selecting a plan and payment details even for Zero Trust Free. Account onboarding has not been completed; Free entitlement/seat availability must be confirmed there without purchasing an upgrade.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): currently Free 200k events/day, three-day retention. The docs announce a pricing change December 1, 2026; recheck if deployment is delayed. [Static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): asset storage is separate from the proposed R2 buckets; Worker execution still has its own limits.

## Private configuration and resource review

The unchanged generator `scripts/prepare-cloudflare-staging.mjs` creates three private configs with `workers_dev=false`, `preview_urls=false`, no DNS routes, empty Cron arrays, no AI or paid-service bindings, `nodejs_compat`, compatibility date 2026-10-18. No staging Worker exists remotely. Current ignored configs contain a **synthetic UUID and synthetic subdomain**, so they are not deployment inputs. Do not run deploy against those files.

| Component | Reviewed bindings / isolation |
|---|---|
| `down-distance-staging-web` | `API_SERVICE` → `down-distance-staging-api`; `ASSETS` → local `.open-next/assets`; `APP_DB`, `APP_OBJECTS`, `APP_BACKUP` shared with staging API only |
| `down-distance-staging-api` | `PASSWORD_SERVICE` → `down-distance-staging-password`; same new staging storage; no public route |
| `down-distance-staging-password` | Private Argon2id Wasm service, no D1/R2/application secrets |
| `down-distance-staging-app` | New staging-only database; must bind its returned UUID to `APP_DB`, read back name/UUID/account before migrations |
| `down-distance-staging-objects`, `down-distance-staging-backups` | Separate private Standard buckets; unavailable until R2 onboarding; no public bucket access or automatic deletion |
| Scheduled/ingestion Workers | Not included; no content-engine/scheduler/application/odds processor deployment |

Staging Worker names are absent from the live inventory, and no D1 names collide because there are no databases. R2 names cannot be remotely validated until the service is enabled. Resource names alone **cannot prevent** binding a production UUID; the generator validates UUID syntax, not ownership. Mandatory future gate: pin the account environment, compare the returned fresh database UUID against its name/account, verify both bucket names, and refuse any pre-existing unverified target. Never reuse a production UUID, bucket, Worker name, credential or DNS route. No remote connection exists today.

Provider and ingestion flags remain false: password, content, briefings, odds, odds processing, mail, maintenance, social notifications and public caching. PostgreSQL URLs, OAuth/provider/payment/push keys and automation secrets are absent from generated config. No `.env` is uploaded. `PRELAUNCH_MODE=false` relies on disabled routes first and a validated Access gate before exposure; it is not itself staging access control.

Required future secrets: a new random staging-only `AUTH_JWT_SECRET` shared between web/API (at least 32 characters), and an independent new `APP_MAIL_ENCRYPTION_KEY` on API. These were not generated, read from production, compared against production values, or uploaded. Use approved secret storage and interactive prompts, never committed plaintext. Account OAuth is deployment authorization, not an application authentication secret.

The retained static assets contain 1,509 files, largest 5,532,574 bytes, total 511,647,947 bytes as inspected; each fits the current 25 MiB/file limit and count fits 20k files on Free. The prior dry-run records report uncompressed bundles: web 12,160.31 KiB, API 5,162.38 KiB, password 226.46 KiB; all fit the current 64 MiB limit. Asset storage is not added to R2 projections. No build or upload was repeated. Startup/CPU remains a hosted qualification item.

## Deployment sequence, health checks and rollback

**Do not execute remote creation/deployment commands under this preflight.** The detailed commands remain in `CLOUDFLARE_STAGING_DEPLOYMENT_PLAN.md`. The following sequence pins the now-known account/subdomain and supersedes generic placeholders except the UUID that cannot exist before approved creation.

After the account prerequisites and a later deployment authorization, run from this worktree, using a reviewed authorized credential. Confirm names do not exist immediately beforehand:

```sh
export CLOUDFLARE_ACCOUNT_ID=6e8c301360ab628706dcf3acf55f0dbb
node node_modules/wrangler/bin/wrangler.js whoami
node node_modules/wrangler/bin/wrangler.js d1 list
node node_modules/wrangler/bin/wrangler.js r2 bucket list
node node_modules/wrangler/bin/wrangler.js d1 create down-distance-staging-app
node node_modules/wrangler/bin/wrangler.js r2 bucket create down-distance-staging-objects
node node_modules/wrangler/bin/wrangler.js r2 bucket create down-distance-staging-backups
```

Record and verify the newly returned staging UUID, then replace `NEW_STAGING_DATABASE_UUID` below. Regeneration resets public routing/passwords to disabled. Compare the remote name/UUID/account before proceeding.

```sh
node scripts/prepare-cloudflare-staging.mjs NEW_STAGING_DATABASE_UUID tdingman5
node scripts/build-password-worker.mjs
node scripts/build-split-worker.mjs
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/password.json
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/api.json
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config .staging/web.json
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

Migrations apply in ordered files 0001–0038; checksums were recorded in `reports/staging-preflight/local-review.json`. No migration was edited or executed remotely. Do not import real users. Deploy dependencies password → API → web, all private, then provision matching staging secrets. Configure **hostname-only** Access for `down-distance-staging-web.tdingman5.workers.dev`, named testers, no Everyone/bypass, suitable existing/non-email-OTP login. Do not change account-wide Access or the existing scheduler. Only after policy review, enable `workers_dev=true` on web alone and redeploy web using the exact command above. API/password/preview routes remain disabled.

Post-deployment checks required before declaring a hosted canary successful:

1. Logged-out browser requests to `/`, `/api/auth/config`, `/_next/static/...` must be intercepted by Access. A synthetic `Cf-Access-Authenticated-User-Email` header alone must not grant entry. Never bypass Access to test app APIs.
2. Authorized tester reaches the staging hostname and canonical pages; `/api/auth/config` reflects password disabled, no external auth providers. No database or secret details appear in responses. App login testing must wait for the approved password CPU canary.
3. Access-authorized but app-anonymous `/api/user/saved-content` rejects access; protected/private responses are no-store. Two synthetic app owners cannot read each other's saves, sessions or Front Office data. Verify original IDs survive a controlled redeploy/restart and saved editorial links resolve.
4. During an approved bounded password canary, temporarily enable password on API only; exercise registration, invalid/valid login, concurrent sessions, reset via offline encrypted outbox inspection, logout and expiry. Never deliver real email. Keep Argon2id strength unchanged; disable again if CPU fails.
5. No Cron runs, ingestion, mail dispatch, payment/provider calls or public R2 URLs. Compare account counters after each small workflow group; stop before agreed budgets. Record version IDs and sanitized failures.

CPU/logging preparation is unchanged: `observability.enabled=true`, sampling 1 for small canary; structured application counters cover D1/R2 and wall time, **not CPU**. Observe each Worker separately through Cloudflare Metrics CPU Time per execution with sample counts/version/time range and exceeded-resource errors. Existing account total CPU does not validate password runtime. `node node_modules/wrangler/bin/wrangler.js tail --format json --config .staging/api.json` and equivalents are diagnostic; sanitize sensitive URLs and do not assume tail always exposes CPU fields. Use authoritative dashboard D1 row/storage and R2 storage/Class A/B account totals for budgets; include other workloads, migration/index/restore overhead and logs.

Suggested existing stop budgets remain 1k staging invocations/day, 100k reads/10k writes per day, <100 MiB staging D1, <250 MiB combined R2, 10k A/50k B operations per month. At observed Workers/D1 usage there is room for these budgets, but they are neither a usage forecast nor a billing cap. R2 cost/headroom cannot be signed off before onboarding and budget review. No automated alert or email is enabled.

Rollback: save `deployments list` results for each staging config before changing a version. Freeze writers; leave schema additive and storage untouched. `node node_modules/wrangler/bin/wrangler.js rollback PREVIOUS_VERSION_ID --config .staging/api.json` (and compatible web/password versions) performs code rollback; review bindings/secrets afterward. First deployment has no prior version—keep routes disabled and prepare a corrected private deployment. For unsafe exposure, disable web routing first. For data recovery use a matched, verified D1/R2 checkpoint into a **new isolated unserved target**, verify hashes/foreign keys/IDs/ownership/replay, then review any rebind. D1 Time Travel alone does not restore R2. Never down-migrate populated tables, delete original objects, or flip to stale PostgreSQL. [Official rollback semantics](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) confirm code rollback is not a database recovery mechanism.

## Minimum actions necessary to proceed

1. **Owner decision on R2:** review Storage & databases > R2 > Overview/Plans and its `$0 + additional usage` subscription terms. Current instructions prohibit activation here. An account owner must separately authorize/complete the subscription/payment requirements or provide an already-enabled authorized staging account. If metered-service activation is categorically prohibited, this D1 + R2 deployment remains NO-GO; do not silently substitute lossy storage.
2. **Owner-managed Zero Trust Free onboarding:** review the Free plan and required billing details under Zero Trust setup, without purchasing Paid. Confirm applicable seat limits and an identity provider that does not send real email. Then authorize/configure a hostname-specific Access policy; verify it before any public web route. Enabling onboarding/policies was outside this read-only phase.
3. Recheck the chosen account's quotas, R2 state, names, logs/billing and credential permissions immediately before deployment. If another account is used, update/pin account, subdomain and all inventory evidence. Set only new staging application secrets; no production reuse.
4. Obtain approval for fresh resources, migrations and private dependency deployment. Then run the exact sequence above, qualify hosted CPU in a small Access-protected canary and rerun only changed/hosted workflows. Hosted CPU is a canary acceptance gate, not something local tests can settle before the first deployment.

**No further local regression run was necessary:** application, generator, migrations and runtime are unchanged. Baseline evidence remains 1,065 application passes (two skips), 119 Worker/D1 passes, 48 browser route passes plus 12 contracts, actual local authentication PASS. This phase performed account metadata inspection, configuration/resource review and checksum/asset inspection only. No native device or hosted performance validation is claimed.

No remote resources, policies, secrets, subscriptions or deployments were created or modified; no paid services, ingestion, real emails or production DNS changes occurred. **Stop for review.**
