# RC3 hosted staging qualification — October 20, 2026

**Controlled beta readiness: NO-GO.** Bounded hosted testing is complete for the safe workflows available in this environment. Security controls passed; functional API authentication and most persistence workflows passed. Actual CPU exceeds Workers Free limits, authenticated web pages fail session verification, and the global NFL story feed fails. Staging public exposure is **disabled**, verified at **2026-10-20T13:25:08.756Z**. No bypass was observed.

| Required result | Result |
| --- | --- |
| Redirect-aware harness | **PASS** — 15 local regression tests; same-origin login redirect and browser hydration verified |
| Staging security | **PASS** for tested anonymous/invalid/expired credential, asset/API protection, redirects and internal Worker URLs |
| Authorized access | **FAIL overall** — staging credential, exact assets, login UI and APIs pass; signed-in product pages return 503 |
| Hosted authentication | **PASS functional synthetic API flows** — registration, verification, login, logout, concurrent sessions, expiry and reset behavior; CPU qualification fails separately |
| Hosted Worker CPU | **FAIL** — observed password CPU 52–200 ms versus Workers Free's documented 10 ms per request |
| Ten-D1 routing | **FAIL overall** — 32/32 team story routes and cross-shard saves pass; global NFL feed returns 500 |
| Product smoke tests | **FAIL** — signed-in web pages unavailable; detailed API results below |
| D1 quota headroom | Latest snapshot: **4,933,739 rows read / 97,224 rows written** remaining that UTC day; storage **5,525,504 bytes** across ten databases |
| Hosted recovery | **UNVERIFIED** — no isolated empty capacity; no actual hosted restore performed |
| External integrations | **UNVERIFIED**, intentionally disabled; fixtures do not verify live providers |
| Controlled beta readiness | **NO-GO** |
| Remaining blockers | Free CPU incompatibility, web session verification, global feed routing, unavailable Three & Out, unverified hosted restore and provider/native gates |
| Exact next owner action | Keep staging disabled. Authorize focused fixes for web session verification/global feed and a demonstrated Free-compatible CPU path preserving Argon2id parameters; then repeat affected hosted checks. Authorize an empty-target recovery procedure separately. |
| Branch | `release/down-distance-rc3` |
| Commit | Implementation, harness and hosted evidence: **2841d350**; this report is finalized in the following documentation commit (`git rev-parse HEAD`) |
| Baseline | `436a894d`; prior resumed deployment `bedeb612`; requested RC3 baseline `1dc29c82` |

## Environment and safety

Staging URL: https://down-distance-rc3-staging-web.tdingman5.workers.dev — **OFFLINE**.

Read-only inventory before testing and after testing confirmed intended account `6e8c301360ab628706dcf3acf55f0dbb`, the exact ten database IDs from the [existing manifest](reports/hosted-staging-rc3/created-databases.json), and the same five staging Workers. The existing unrelated `dnd-content-scheduler` was not modified. **No additional database or Worker was created.** All five staging Workers end with workers.dev/previews disabled and no schedules. Internal Workers were never enabled publicly. [Final inventory](reports/hosted-staging-rc3/completion/account-final.json), [final Worker settings](reports/hosted-staging-rc3/completion/workers-private-settings.json), [verified disable](reports/hosted-staging-rc3/completion/exposure-disable.json).

Workers Free status remains based on the owner's October 20 dashboard evidence. The subscriptions API still returns 403; it does not independently verify plan status. No billing activation, payment method, R2, paid service, external AI/email/push/sportsbook integration, ingestion schedule, production data, downdistance.com or Vercel change occurred. All accounts and newly seeded content were synthetic. Secrets and session tokens remained outside the repository in restricted files; exported evidence contains sanitized metrics and synthetic identifiers.

The reviewed static correction remains Web version `128d76b3-4e45-46f8-8060-104c0f984859`. No product-code correction was deployed in this mission. The **unchanged private API Worker** was redeployed once, with identical staging settings/secrets, to test persistence; resulting version `2c9bdb4a-570e-416e-814e-a813ebf7a608`. Schedules/providers remained off. [Redeployment evidence](reports/hosted-staging-rc3/completion/deploy-private-api-with-secrets.log).

## Redirect and security qualification

The harness separates staging access from application authentication. It accepts the signed-out protected-page redirect only when it points to same-origin `/login` with the correct `next` value, follows a bounded chain, and verifies the login payload. It rejects untrusted origins, unexpected destinations, missing Location, wrong next values, loops, hop-limit exhaustion, unauthorized success, denied authorized access and unexpected authenticated redirects. Application-session absence was separately verified through `/api/auth/me` returning 401. Fifteen local regression tests pass. [Harness and instructions](scripts/hosted-staging/README.md), [regression results](reports/hosted-staging-rc3/completion/harness-regression.log).

Anonymous home, JavaScript, favicon, auth configuration and login requests returned 403; invalid cookie, spoofed certificate/Bearer headers and correctly signed expired cookie returned 403. Invalid staging credentials returned 401. Correct credentials returned 303 with Secure/HttpOnly/SameSite=Strict cookie attributes. Authorized JavaScript returned 200 and exactly matched the local build SHA-256. The home redirect reached same-origin login; Chrome hydrated the email login form with a password input. All four internal Worker public URLs returned denied/not-found responses. [Security results](reports/hosted-staging-rc3/completion/security.json), [browser results](reports/hosted-staging-rc3/completion/browser-final.json), [login screenshot](reports/hosted-staging-rc3/completion/login-email-browser.png).

Two non-security harness assumptions were corrected during this mission: a client-rendered login form has no initial server-rendered password input, and workers.dev enablement can initially return a platform 404 during propagation. Fail-safe disabling occurred during those checks. A bounded readiness poll requires the deployed gate's 403 before qualification; it never accepts anonymous content. Both diagnostic attempts are retained. No bypass or unexpected public exposure occurred. The staging access gate itself was unchanged. Shared workers.dev does not provide this account a controlled mTLS hostname; the previously authorized server-side credential alternative remains in use. No mTLS claim is made.

## Authentication and actual hosted CPU

Three synthetic `example.invalid` accounts were used. Hosted API results passed registration, correct/wrong password verification, login, concurrent sessions, session listing, logout/revocation, retention of another concurrent session, product-session expiry, invalid/expired reset rejection, successful reset, single-use reset replay rejection, reset revocation of active sessions and login using the new password. Unknown/existing reset requests retained generic responses. No email was sent. Known synthetic token hashes and one synthetic session expiry were set directly in the isolated users database to test expiry/reset without changing production configuration or waiting 30 days. This does not verify email delivery or an end-to-end delivered reset link. [Functional authentication evidence](reports/hosted-staging-rc3/completion/authentication.json).

These are **actual Cloudflare trace CPU milliseconds**, not local elapsed time, application wall timers or deployment startup times:

| Operation in dedicated measurement run | API Worker CPU | Internal password Worker CPU |
| --- | ---: | ---: |
| Registration | 18 ms | 90 ms |
| Incorrect-password verification | 5 ms | 52 ms |
| Successful login | 9 ms | 54 ms |
| Password reset | 3 ms | 61 ms |
| Login with reset password | 7 ms | 66 ms |
| Session read/list | 1–3 ms | Not invoked |
| Logout | 2 ms | Not invoked |

An earlier actual registration trace measured API 41 ms/password 200 ms; another verification measured password 178 ms. Selected product traces also measured Front Office read 111 ms, team feed 71 ms and homepage API 16 ms. These are individual observations, not latency percentiles or a sustained-load benchmark. [Measured authentication traces](reports/hosted-staging-rc3/completion/measured-operations.json), [initial traces](reports/hosted-staging-rc3/completion/trace-events-initial.json), [product traces](reports/hosted-staging-rc3/completion/persistence-and-product-metrics.json).

Cloudflare documents **10 ms CPU per HTTP request on Workers Free**, with occasional execution flexibility. Successful low-volume responses above that limit do not qualify sustained use. No observed password response was an 1102 resource-limit error, and the captured invocation outcomes were `ok`; the measured requirement still fails the Free CPU budget. Argon2id remains memory 19,456 KiB, two iterations, parallelism one. Hashing was not weakened and no billing/CPU-limit upgrade was made. [Cloudflare CPU limits and flexibility](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).

## Ten-D1 and product smoke results

Thirty-two clearly marked synthetic stories were seeded, one per team, across the eight existing team shards, plus one global fixture in shared storage. All **32/32 team story API routes** returned their correct synthetic IDs. This verifies hosted API routing, not 32 rendered browser team pages. Global NFL list routing returned 500; local inspection shows its D1 projection uses `applicationTeamStorage(teamId)`, which rejects the non-team NFL identifier. The global fixture itself resolved correctly through cross-shard saving from shared storage.

| Workflow | Hosted result |
| --- | --- |
| Homepage | API 200 with synthetic team content; signed-in page **503** |
| The Beat / Film Room / Three & Out / The Huddle pages | **503** at application-session verification |
| Three & Out API | **503**, verified edition unavailable; no generation/provider claim |
| The Huddle API | **503 by existing design**, visual concept with live server actions disabled |
| AI Search deterministic path | **200** with deterministic provider configured; no external inference or semantic/live-answer claim |
| Trivia | Initially no question; after one labeled synthetic fixture, question/answer **200**, replay `accepted:false` |
| Move the Chains | Correct answer awarded one yard; replay did not duplicate it; readback retained one yard, other user zero |
| Front Office | Versioned/command-ID creation and state read **200**; another user's access **404** |
| Parlay Lab | Stored events/props/freshness/movement APIs **200** with isolated/empty data; page **503**, generator/browser workflow unverified |
| Trending Props / Bet Slip | Stored API/synthetic saved-bet path exercised; full browser selection/generation and live quotes **UNVERIFIED** because authenticated shell fails |
| Profile | PATCH/readback **200**, other user's profile isolated |
| Saved articles | KC, BUF and global NFL saves **201**, readback **200** |
| Saved bets | Synthetic self-reported snapshot **201**, readback **200**; no live source-board/provider verification |
| Cross-shard references | Three **COMMITTED** receipts, correct owner payloads complete and pinned; private tables only in users shard |
| Persistence | Session, profile, article/bet saves and Front Office state survived unchanged private API redeployment |

An initial Front Office metadata request without command/version correctly returned 428, and lookup of a never-created save returned 404. The proper creation protocol subsequently passed. Signed-out private saved-content access returned 401. Another signed-in user could not see the first user's saved items or franchise. [Product requests](reports/hosted-staging-rc3/completion/products.json), [Trivia/progress](reports/hosted-staging-rc3/completion/trivia-and-chains.json), [read-only shard/reference checks](reports/hosted-staging-rc3/completion/final-d1-readonly.json), [persistence results](reports/hosted-staging-rc3/completion/persistence-and-product-metrics.json).

Chrome verified login hydration, then reproduced authenticated 503s at home, Front Office, Parlay Lab and Account. Direct API session checks returned 200 for those sessions. The existing middleware returns “Sign-in verification is temporarily unavailable” when its internal session lookup fails; this remains an application defect to investigate, not an authorization bypass. Browser off-host requests were blocked. The Film Room metadata API can invoke YouTube fallback, so it was not called to manufacture a provider success. No shared UI/native implementation changed. Android/iOS device validation remains UNVERIFIED.

## Quota, query counts and error rates

Actual account snapshots, subject to analytics ingestion lag:

| Metric | Before products, 13:13:14 UTC | After tests, 13:27:33 UTC |
| --- | ---: | ---: |
| D1 rows read | 63,786 | **66,261** |
| D1 rows written | 2,131 | **2,776** |
| D1 read queries | 481 | **1,083** |
| D1 write queries | 785 | **1,193** |

Observed deltas were 2,475 rows read and 645 rows written, 602 read queries and 408 write queries. These include account/admin/fixture activity and are not a per-user workload model. D1 metadata and request instrumentation are preserved separately; the test did not approach the 100,000 new-read-row / 10,000 new-write-row safety thresholds. Remaining daily allowances at that snapshot were **4,933,739 read rows and 97,224 written rows**. REST inventory at 13:27:34 UTC measured **5,525,504 bytes** across ten databases. Largest database was approximately 1.6 MB, well below the Free per-database ceiling. No ten-slot capacity remains for a second restore generation.

Worker analytics reported **355 account requests**: 352 under `__unknown__` and three for the pre-existing scheduler. Script-name attribution for that bucket was unavailable; it is not labeled as exact staging-only traffic. The snapshot leaves 99,645 requests against the 100,000/day allowance. All three runtime errors belonged to the pre-existing scheduler; the unknown bucket reported zero runtime errors. This **does not mean zero application errors**: the principal 65-request product batch had **15 HTTP 5xx responses (23.1%)**. That batch is a defined sample, not an account-wide error rate. The dedicated captured authentication/product traces had `ok` outcomes, including application error responses.

Selected actual API invocations used at most **27 SQL statements / 14 D1 calls**, including batches counted separately. Initial signup used 27 statements; dedicated signup 25, login 16, reset 11, session reads 2–4; sampled Front Office read six and homepage API 14. This coverage is not every route/invocation, and no unmeasured maximum is claimed. Gate-cookie requests do not add credential-counter queries; credential submissions do. No full-day ingestion replay or DAU capacity certification was attempted. [Before analytics](reports/hosted-staging-rc3/completion/metrics-before-products.json), [after analytics](reports/hosted-staging-rc3/completion/metrics-after-products.json), [final storage inventory](reports/hosted-staging-rc3/completion/account-final.json).

## Recovery and remaining owner actions

Hosted recovery is **UNVERIFIED**. All ten slots are occupied. No database was deleted, emptied, overwritten or restored, and no backup fence was acquired against occupied data. Source review confirms backup requires stopped raw writers plus coordinated ten-shard fences, authenticated archives and verified references. Restore authenticates archives/current independent erasure ledger, checks every destination is empty, restores content before private references, replays revocations, verifies integrity/references and unlocks only after success. Actual read-only checks found zero erasure-ledger rows; the ledger was not replaced or changed. [Safe recovery plan](reports/hosted-staging-rc3/completion/recovery-readiness.md).

Owner actions, in order:

1. Keep staging offline and retain **NO-GO**. Authorize focused remediation for the failing web session lookup and global NFL feed; preserve the access gate and existing architecture.
2. Resolve the measured CPU incompatibility under the existing Free/no-billing and unchanged Argon2id constraints. Successful small bursts are insufficient; do not weaken hashing or infer paid-plan authorization.
3. After reviewed local fixes, repeat affected hosted authentication, CPU and rendered product checks, including Three & Out and complete Parlay/Bet Slip flows. Preserve provider/schedule gates and bounded quotas.
4. Separately approve a feasible empty-target restore strategy before destructive maintenance or restoring any occupied shard. Do not delete staging merely to make room. Actual hosted recovery must pass before claiming it passed.
5. Complete separately gated external integration and native device validation before production readiness is considered.

All temporary telemetry sessions were closed/expired; final staging tail listings were empty. The final environment is private and deliberately offline. Full machine-readable results: [summary.json](reports/hosted-staging-rc3/completion/summary.json).
