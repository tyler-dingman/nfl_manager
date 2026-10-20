# RC3 resumed hosted qualification — October 20, 2026

**Ready for controlled beta: NO. Static-asset correction deployed and verified; qualification stopped, public staging disabled.** This section supersedes the historical attempt below. Resume baseline: `bedeb612`, branch `release/down-distance-rc3`.

| Requested result | Result |
| --- | --- |
| Static asset correction | **PASS** — hosted JavaScript 200, 4,502 bytes, SHA-256 exactly matches the local deployed build |
| Unauthorized access | **PASS** for completed anonymous home/assets/API, invalid cookie, spoofed headers, signed expired cookie and invalid staging credential checks |
| Authorized staging access | Credential **PASS**; full application access **UNVERIFIED** — harness stopped on home 307 |
| Hosted authentication | **UNVERIFIED**, signup/Argon2id/login not run |
| Hosted CPU | **UNVERIFIED**, no actual staging request CPU collected in this run |
| Ten-D1 functionality | Exact ten IDs/bindings/account **VERIFIED**; full runtime workflows **UNVERIFIED** |
| Product smoke tests | **UNVERIFIED / NOT RUN** after stop |
| D1 usage | Pre-test actual storage **5,169,152 bytes** across ten databases; new row/query totals not measured after stop |
| Hosted recovery | **NOT RUN**; safe plan below; no empty isolated capacity available within ten-slot ceiling |
| Remaining blockers | Incorrect signed-out page test expectation; remaining security, product, CPU/quota and recovery validation |
| Ready for controlled beta | **NO** |
| Next required action | Resume stopped qualification with a redirect-aware page check, verify login rendering and protected APIs/internal endpoints, then bounded synthetic workflows and actual metrics |
| Commit | Commit containing this updated report (`git rev-parse HEAD`); implementation baseline bedeb612; corrected hosted Web version below |

## Verified resources and deployment

Wrangler refreshed the expired OAuth session. Read-only inventory then confirmed account `6e8c301360ab628706dcf3acf55f0dbb`, exactly the ten staging database names/IDs in the existing manifest, and all five intended staging Workers. The unrelated dnd-content-scheduler remains untouched. Each staging Worker had workers.dev/previews disabled and no schedules; D1 and service bindings referenced only the intended staging resources. These settings were read again after deployment before enabling the Web endpoint for testing.

Only the existing Web Worker was redeployed, with the already reviewed authenticated static-asset dispatch correction and existing isolated staging secrets, while public exposure remained disabled. Version: **128d76b3-4e45-46f8-8060-104c0f984859**. No additional databases or Workers were created. Billing, R2, paid services, providers, ingestion, email/push and production schedules were not activated. No production data, downdistance.com or Vercel resources were modified. Internal Workers stayed private. See [resume inventory](reports/hosted-staging-rc3/resume/account-before.json), [private settings](reports/hosted-staging-rc3/resume/workers-private-settings.json) and [deployment log](reports/hosted-staging-rc3/resume/deploy-private-web-with-secrets.log).

## Ordered checks and reason for stopping

Anonymous home, JavaScript, favicon, auth configuration and login requests returned 403. Invalid cookie, spoofed certificate/Bearer headers and a validly signed expired staging cookie returned 403. The generic access form returned 200; invalid credential returned 401; correct credential returned 303 with Secure, HttpOnly and SameSite=Strict cookie attributes. Authorized JavaScript returned 200 and matched the local build SHA-256 `5f571f7056348fea095eb044da227c5863d3a345d2fe3f85d50308d097ab7bcb`.

The next request, `/` with staging authentication but no product session, returned **307**. The harness incorrectly expected an immediate 200 and invoked its fail-safe disable. Local inspection of src/middleware.ts and src/lib/application-access.ts confirms that the home page requires a separate application session and signed-out users are redirected to `/login`; staging access alone does not establish that session. The hosted Location header was not recorded, so its destination and login rendering remain unverified. This is a **test expectation failure, not evidence of a security bypass or a confirmed application defect**. The test should validate a same-origin allowed redirect and then the login HTML; it must not broadly accept arbitrary redirects.

Public staging exposure was disabled and its disabled/previews-disabled state verified at **2026-10-20T13:04:21.918Z**. Remote execution stopped; no subsequent remote reads or requests were made. API-positive checks and direct internal public-URL probes were not reached. Internal endpoint settings were verified private, but this does not substitute for those probes. Evidence: [security records](reports/hosted-staging-rc3/resume/security.json), [stop record](reports/hosted-staging-rc3/resume/security-failure.json), [verified disable](reports/hosted-staging-rc3/resume/exposure-disable.json).

No registration, Argon2id/login, 32-team route sweep, cross-shard references, Front Office, Parlay Lab, saved content, application session expiration, restart/persistence or browser rendering tests ran. Only staging-cookie expiration was tested. No final CPU or D1 row/query measurements were collected after the stop, and no local timing or deployment startup figure is presented as hosted CPU. Historical pre-security metrics below are not current totals. The pre-test database inventory measured 5,169,152 bytes of storage; it does not qualify DAU capacity.

## Safe recovery plan and next run

The existing ten databases fill the Free account's ten-slot ceiling. Do not create additional destinations, restore over occupied shards or replace the independent erasure ledger. A non-destructive next step is to design a coordinated synthetic backup under a stopped-writer fence, recording all ten role schemas, original IDs, shard/reference metadata, archive integrity and the latest independent erasure ledger. Validate corrupt/missing/interrupted archive rejection offline. Actual hosted restore must wait for separately authorized empty isolated destinations, either capacity available without paid activation or an explicitly approved synthetic-only evacuation/reprovision of the same ten slots. Keep revocation replay and reference/user-progress checks in the restore acceptance plan. No backup/restore success is claimed here.

The next run should start from the disabled endpoint, use a redirect-aware check that records a sanitized Location, establish the distinction between staging access and product authentication, finish API/internal protection checks, and only then run bounded synthetic product tests. Retain the previous maximum budget of 5,000 Worker requests, 100,000 D1 rows read and 10,000 rows written, with actual analytics/query metadata checks and no full-day replay. Keep hashing parameters unchanged. No Android/iOS device validation occurred.

# Earlier deployment attempt — historical record

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
| Commit | Implementation/evidence commit **95019e9d**; report normalization follows in HEAD. Preparation baseline d6d3ff10; requested RC3 baseline 1dc29c82 |

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
