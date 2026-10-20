# RC3 hosted staging results — October 20, 2026

**Production readiness: NO-GO. Partial deployment; hosted qualification stopped.** Ten isolated D1 databases and five Workers were deployed. The first authorized static-asset request returned 404. Web public exposure was disabled and verified at **2026-10-20T12:34:36.280Z**. No unauthorized bypass was observed. A local correction is verified but has not been deployed.

| Required result | Result |
| --- | --- |
| Staging URL | https://down-distance-rc3-staging-web.tdingman5.workers.dev — **DISABLED** |
| Staging deployed | **YES**, resources deployed; application acceptance **FAIL**, endpoint offline |
| Account Workers Free | **VERIFIED from owner dashboard evidence dated October 20**; subscription API read remains 403, not independent plan verification |
| Billing activation / payment method | **NONE**; neither activated nor added |
| Databases created | **10**, eight team + users + shared, named dd-rc3-staging-1 through -10 |
| Workers deployed | **5**: password, API, odds processor, application, Web |
| Private access protection | Server-side credential gate deployed; overall qualification **FAIL** on authorized asset availability; public endpoint disabled |
| mTLS protection | **UNAVAILABLE / NOT CLAIMED** on the shared workers.dev host; owner-authorized server-side alternative used |
| Unauthorized access tests | **PASS** for tested anonymous assets/APIs, invalid cookie, spoofed headers, and correctly signed expired cookie |
| Hosted authentication | **UNVERIFIED**: product signup/login, Argon2id and reset not exercised |
| Hosted Worker CPU | **UNVERIFIED**: no staging per-request CPU measurement; deployment startup timings are not authentication CPU |
| Ten-D1 operation | Schema/migration/integrity **PASS** across ten; application operation **UNVERIFIED** |
| D1 queries / daily usage | Actual pre-security snapshot below; final post-test totals **UNVERIFIED** |
| Cross-shard workflows | **UNVERIFIED** |
| Application/browser smoke tests | **NOT RUN** after failed acceptance gate |
| Hosted recovery | **UNVERIFIED**, no destructive or additional-destination recovery authorized |
| Live integration gates | Email, AI, sportsbook, production ingestion and all staging schedules remain disabled; provider credentials absent |
| Native device validation | **UNVERIFIED**; no Android/iOS device build or validation in this mission |
| Production readiness | **NO-GO** |
| Branch | release/down-distance-rc3 |
| Commit | Commit containing this report; retrieve with `git rev-parse HEAD`. Preparation baseline d6d3ff10; requested RC3 baseline 1dc29c82 |

## Account and resource safety

The initial account inventory contained zero D1 databases and one unrelated Worker, dnd-content-scheduler. The owner supplied Workers Free, no-payment-method, unused D1 quota and no-domain dashboard evidence. Read-only account and analytics checks supported the empty D1 inventory. The subscription endpoint returned 403; it was not represented as a successful API plan check or a paid-plan indication. Deployment required no upgrade or billing activation.

Only the ten isolated staging databases and five staging Workers were created. Actual database IDs are recorded in [created-databases.json](reports/hosted-staging-rc3/created-databases.json) and the five config/rc3-hosted.*.toml files. Each role's migrations applied successfully; repeating all ten was a no-op. Hosted foreign-key checks, quick checks, canonical schema fingerprints, and initial private-data checks passed: [schema evidence](reports/hosted-staging-rc3/schema-verification.json).

No R2, PostgreSQL, paid-service binding, real user migration, production database, production DNS, downdistance.com, Vercel resource, billing setting, or existing scheduler was modified. All five staging Workers have workers.dev and previews disabled after the stop; schedules are empty. Four internal Workers were never publicly enabled. Their actual settings were checked; planned direct HTTP probes were not reached.

The account's ten slots are occupied by this staging generation. There is no assumed parallel twenty-database capacity. Future production conversion or recovery needs separately approved use of the same ten slots, coherent authenticated backups, current independent erasure ledger, stopped writers, and empty restore destinations. No wipe, deletion, conversion or restore occurred. See [safety and ten-slot transition plan](reports/hosted-staging-rc3/safety-plan.md).

## Access gate and failed acceptance test

Cloudflare's documented edge mTLS setup requires a controlled zone/hostname; no such domain was available. The latest mission authorized a server-side alternative on workers.dev. A fresh isolated credential protects dispatch to assets, app and APIs. Its signed host-bound cookie is Secure, HttpOnly and SameSite=Strict, expires in one hour, and has an overall deadline of October 22 at 12:20:33 UTC. D1-backed limits persist across isolates; missing configuration or backend errors fail closed. Only the generic credential form is public. Secrets are stored outside the repository with restricted file permissions and were checked against pending repository files for accidental inclusion.

Hosted tests denied anonymous home, JavaScript, favicon, auth configuration and login requests (403); invalid cookies and spoofed certificate/Bearer headers (403); and a validly signed expired cookie (403). The credential form returned 200, incorrect credential 401, and correct credential 303 with the required cookie attributes. The next test, a real authorized JavaScript asset request, returned **404 instead of 200**. This establishes a failed positive acceptance test, not an observed authorization bypass.

The Web workers.dev route was immediately disabled using the API and its disabled state read back. Remote execution then stopped under the mission instruction: “If a safety gate fails, stop remote execution, preserve the environment safely, and report the blocker.” No further remote analytics, redeployment, or product testing followed. Evidence: [security results](reports/hosted-staging-rc3/security.json), [failure](reports/hosted-staging-rc3/security-failure.json), [verified disable](reports/hosted-staging-rc3/exposure-disable.json).

The deployed adapter routes authorized requests to OpenNext, but run_worker_first moves static requests through that adapter; OpenNext's generated handler does not itself serve these static assets. The local correction explicitly dispatches authorized GET/HEAD asset requests through the ASSETS binding, then falls back to the application on 404. API requests go directly to the application after authorization. The gate remains outside both paths. This correction **is not deployed**; the deployed entry point is preserved in [deployed-access-index.ts.txt](reports/hosted-staging-rc3/deployed-access-index.ts.txt).

Local correction validation: two targeted tests pass, including denied requests never reaching assets and authorized requests receiving asset content; release completion TypeScript check passes; network-blocked Web Wrangler dry run passes. Evidence is in reports/hosted-staging-rc3/local/. An earlier strengthened-test fixture failure is retained alongside the corrected passing run. Completed broad RC3 local suites were not repeated. No shared UI or native screen changed.

## Actual measurements and unverified workflows

The account-wide D1 analytics snapshot at **2026-10-20T12:27:27.858Z**, after migration/schema work and before security requests, reported:

| Metric | Measured |
| --- | ---: |
| Read queries | 453 |
| Rows read | 58,921 |
| Write queries | 767 |
| Rows written | 2,113 |
| Daily read headroom at that snapshot | 4,941,079 of 5,000,000 |
| Daily write headroom at that snapshot | 97,887 of 100,000 |

These are not final totals or a 25–50 DAU capacity qualification. Final storage and post-security usage were not fetched after the stop. Actual hosted query metadata is preserved with the schema evidence. See [analytics snapshot](reports/hosted-staging-rc3/metrics-current.json). No staging request CPU or Argon2id CPU result was obtained. The existing unrelated scheduler's CPU data and local wall-clock timings are not substitutes.

All 32 NFL routes, editorial/global IDs, cross-shard saved content, Front Office persistence, Parlay Lab synthetic workflows, account erasure, retention, product browser behavior, user progress and runtime database isolation remain unverified on hosted staging. No app account was registered. The coordinated backup/restore, missing shard, corrupt archive, interrupted recovery, original IDs, revocation replay and cross-shard reference recovery cases were not run; no erasure-ledger replacement occurred.

## Remaining blockers and exact next owner action

1. Review the local authenticated asset-dispatch correction and **explicitly resume hosted qualification after the safety stop**. First redeploy the corrected Web Worker while private, then enable only its protected endpoint for security checks. Original resource authorization was used; this resume is required by the explicit stop rule.
2. Require successful authorized assets and API access, all denial checks, and internal endpoint checks before product traffic. Disable immediately on a failed gate.
3. Complete bounded synthetic product validation and collect actual staging request CPU, Argon2id behavior, D1 query counts and final account quota/storage measurements. Keep every production/provider/schedule gate disabled.
4. Approve a feasible empty-target recovery procedure within the ten-slot ceiling before any destructive recovery, then perform coordinated ten-database recovery with the current independent erasure ledger preserved.
5. Complete remaining native device and live integration gates separately before any production GO decision.

The current environment is deliberately offline. No additional remote action is required to preserve its safety. Full version IDs, deployment evidence and machine-readable status are in [summary.json](reports/hosted-staging-rc3/summary.json) and [deployed-versions.json](reports/hosted-staging-rc3/deployed-versions.json).
