# Authorized first-staging safety gates

Baseline d6d3ff10, RC3 application implementation fb947516, authorization supplied in the October 20, 2026 mission. The owner observed Workers Free, no payment method, 0/10 D1 databases, zero D1 rows/storage, and no configured domain on that date. Read-only recheck confirms zero databases, one unrelated existing scheduler, and account workers.dev subdomain tdingman5. Subscription API remains 403; this is an unavailable billing read, not evidence of a paid plan. GraphQL independently returns zero D1 activity and three requests/errors for the existing scheduler. That Worker is not a deployment target and will remain unchanged.

## Private access and Free compatibility

The documented edge client-certificate configuration requires selecting a hostname in a controlled zone/domain. This account has no such domain; it cannot configure the shared workers.dev zone for client-certificate presentation. The old gate's request.cf checks alone do not establish mTLS on workers.dev. No mTLS security claim will be made for this deployment.

Instead, the approved server-side alternative wraps the existing Web adapter before any app/asset/API dispatch. A generic credential form is the only public content. A fresh isolated random staging credential is submitted only in a bounded HTTPS POST body, never URLs/logs. Signed host-bound Secure/HttpOnly/SameSite=Strict cookies expire after one hour, with a fixed 48-hour overall staging-access deadline. Secret rotation revokes them. Missing configuration, malformed/expired cookies, backend errors, and incorrect hosts fail closed. Assets use run_worker_first=true for every path, with private/no-store responses and no static fallback exemption.

D1-backed counters allow at most 100 credential submissions/day, 12/min globally, and 4/min per HMAC-derived IP bucket across isolates/restarts. Counter keys are bounded and contain no raw IP or credential. The daily guard reserves first, limiting counter writes to at most 300/day. Valid cookie requests use no D1 gate queries. The gate uses only Workers Web Crypto plus the already-approved D1_USERS binding; no KV, Durable Objects, R2, external service, payment method, or paid rate-limit binding is required.

References checked October 20, 2026:
- https://developers.cloudflare.com/ssl/client-certificates/enable-mtls/ (zone/hostname certificate presentation)
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ (public address behavior, disabling workers.dev)
- https://developers.cloudflare.com/workers/platform/pricing/ (Workers Free)
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ (run_worker_first and Free-quota fail-closed behavior)
- https://developers.cloudflare.com/d1/platform/pricing/ (D1 Free allowances)

Local actual-D1 gate tests must pass before any resource creation. All five Workers initially deploy without public routes, then receive freshly generated staging secrets. Only the Web Worker is subsequently exposed on workers.dev, with the complete gate already present. Internal Workers keep workers_dev=false and preview_urls=false. Unauthorized hosted checks precede all product tests. A bypass requires immediately disabling the Web workers.dev route and stopping testing.

## Validated ten-slot transition strategy

Allocate exactly eight team, one users, and one shared database, using the distinct dd-rc3-staging-1..10 names. They remain synthetic-only; there is no parallel production set. Account inventory and the documented Free maximum validate that these ten fit, but twenty would not.

Production cutover is a future separate approval, not part of this mission: first revoke/disable staging ingress, stop every writer and keep schedules/providers disabled, persist and authenticate the coherent ten-shard synthetic backup plus the current independent erasure ledger, then use an explicitly reviewed synthetic wipe/reprovision or controlled conversion of these same ten slots before importing any production data. Role schemas, routing IDs, epochs, secrets, and baseline references must be verified together. Never intermingle staging testers and real production users.

Rollback consequences: the Free account cannot retain both ten-database generations online. Pre-cutover rollback can return to the existing staging code/data. After reprovisioning, rollback requires an authenticated offline restore into empty destinations and coherent binding changes; blindly downgrading code or restoring over occupied data is prohibited. Production authorization must include a verified feasible backup/restore procedure and downtime. No database deletion, conversion, production migration, DNS/domain change, or destructive recovery is authorized here.

The hosted recovery phase remains UNVERIFIED unless a separately approved feasible empty-target strategy is supplied. It will not trigger extra database creation or destructive replacement simply to complete a test.

## Bounded hosted test budget

No full 18,504-check replay. Stop at 5,000 new Worker requests, 100,000 D1 rows read, 10,000 D1 rows written, any quota/resource-limit failure, or any security bypass; periodically read actual account analytics and query metadata. Keep all cron, ingestion, email/push, external AI, sportsbook, odds-processing, and maintenance flags disabled. Provider credentials remain absent. Argon2 parameters are unchanged: a hosted CPU failure must be reported, not “fixed” by weakening hashing. Missing CPU metrics remain unknown.

## Execution outcome

Ten databases and five Workers were deployed. The authorized static-asset acceptance check returned 404; public Web exposure was disabled and verified at 2026-10-20T12:34:36.280Z. All remote execution stopped under the mission safety-gate rule. The local authenticated asset-dispatch correction passes targeted tests, type checking and a network-blocked dry run, but is not deployed. See ../../DOWN_DISTANCE_HOSTED_STAGING_RESULTS_RC3.md for results and the explicit owner resume action.
