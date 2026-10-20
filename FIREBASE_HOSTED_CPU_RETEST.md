# Firebase hosted CPU retest — October 20, 2026

**CPU qualification: FAIL. Controlled beta: NO-GO.** The reviewed Firebase optimization was deployed only to the existing private staging API/Web Workers. The first registration-related identity exchange consumed **40 ms actual API Worker CPU**, exceeding the **10 ms Workers Free target**. Its Web hop consumed **2 ms**. Staging exposure was disabled immediately at **16:49:39 UTC (11:49:39 a.m. CDT)** and no further application tests ran. All five staging Workers are verified private, previews off, and Cron schedules empty.

| Required result | Result |
| --- | --- |
| Previous hosted CPU | **47 ms**, staging API `POST /api/auth/firebase/session`; one historical sample |
| New hosted CPU by operation | Firebase SDK registration: PASS, no Cloudflare invocation/CPU applicable. First registration-related `POST /api/auth/firebase/session`: **API 40 ms**, **Web 2 ms**, both HTTP 200/outcome ok. Other requested operations remain UNVERIFIED after the stop |
| CPU qualification | **FAIL**. API is 4× the 10 ms target. The observed difference is 7 ms (14.9%) from the prior sample; this is not a statistically established improvement or repeatability result. No warmed-only retries were used |
| Authentication security | **PASS for executed checks**: credential gate, denied anonymous/invalid/expired staging cookies, protected assets/APIs, same-origin signed-out redirect, correct asset bytes, internal Worker denial and genuine Firebase identity exchange. Broader invalid/expired Firebase-token, refresh/logout/revocation and cross-user hosted testing stopped before execution |
| Authenticated SSR | **UNVERIFIED**. Only signed-out `/` → `/login?next=%2F` (307 → 200) was checked. No signed-in page CPU/render claim |
| Global NFL feed | **UNVERIFIED**. Not requested after the CPU stop |
| D1 quota usage | Direct measured exchange: **7 calls / 14 SQL statements / 7 rows read / 21 rows written**. Latest account snapshot: **66,303 read / 2,817 written**; remaining **4,933,697 reads / 97,183 writes**. Aggregates lag and are not the exact run total |
| Remaining blockers | API identity-exchange CPU; function-level CPU attribution; repeated cold/warm/native samples, lookup/refresh/logout/revocation/negative-token/SSR/global-feed qualification; existing broader product/recovery/device gates |
| Recommended next action | Keep staging disabled. Authorize focused local CPU remediation and a separately bounded hosted profiling attempt with an active, identifiable API isolate. Preserve Firebase verification, live revocation, ownership, erasure and gate checks. Review results before another staging upload/retest; no paid CPU increase or provider switch |
| Branch | `release/down-distance-firebase-auth` |
| Commit | Deployed source **4cea12e914a6ab693bd7884a615f2cc15a021bfa**. Hosted evidence commit **89e10e60e5ba**. The following documentation commit contains this report; `git log -1 --format=%H -- FIREBASE_HOSTED_CPU_RETEST.md` identifies the final report commit |

## Preflight and isolated deployment

The clean branch/commit matched the owner-authorized baseline. Actual account **6e8c301360ab628706dcf3acf55f0dbb** inventory matched every expected staging database ID/name and all five staging Worker names. The unrelated existing `dnd-content-scheduler` was unchanged; all assertions about empty schedules apply to the five staging Workers. No new Worker/database, migration, occupied-store restore or real-user migration occurred.

The signed-in Cloudflare console showed **Free / Current plan**, 100,000 daily requests and 10 ms CPU/request. The subscriptions API returned 403, so its response was not used to infer the plan. The existing Firebase console showed **Spark / No-cost ($0/month)** for `down-and-distance-8526c`; the registered app/project configuration matched the private staging configuration. No billing or Firebase setting was changed.

Preflight usage was 378 account-wide Worker requests, 66,303 D1 rows read and 2,817 written, with 5,545,984 bytes of allocated D1 storage. All five Workers had workers.dev and preview exposure disabled, no staging Cron schedules, and only approved staging bindings. Reviewed API/Web flags retained Firebase mode, disabled the password Worker path, ingestion/mail/editorial email/odds providers, and selected deterministic search. No R2, paid-service or production binding was added. The existing gate expiry **2026-10-22T12:20:33Z** was preserved.

Only the previously reviewed `75e6910d..4cea12e9` Firebase CPU changes and timing flag were uploaded. No application source was changed during this retest. The fresh production build and API/Web dry runs passed. An initial sandboxed build could not resolve Google Fonts; rebuilding under the existing isolated font-only network guard with network access passed. Existing unrelated lint/hook warnings remain. The API bundle hash exactly matches the locally validated candidate; Web assets/bundle were regenerated from the same source commit. The 15 redirect harness regression cases also passed.

| Existing staging Worker | Uploaded version |
| --- | --- |
| down-distance-rc3-staging-api | `b39ff746-bab6-47ca-a3c1-e95eff8d07f5` |
| down-distance-rc3-staging-web | `36370c10-75f8-4111-b5b6-a6a95a30235b` |

API and Web were uploaded while private, followed by settings read-back. The other three staging Workers were not deployed. The existing credential-gated Web endpoint was then enabled solely for the bounded test window; public application registration and internal Worker endpoints were never exposed without the gate.

Evidence: [preflight](reports/firebase-cpu-hosted/preflight.json), [before inventory](reports/firebase-cpu-hosted/account-before.json), [before settings](reports/firebase-cpu-hosted/workers-before.json), [fresh bundles](reports/firebase-cpu-hosted/bundles.json), [build](reports/firebase-cpu-hosted/build.log), [deployment records](reports/firebase-cpu-hosted/deployments.json), [API upload](reports/firebase-cpu-hosted/deploy-api.log), [Web upload](reports/firebase-cpu-hosted/deploy-web.log), [private read-back](reports/firebase-cpu-hosted/workers-after-deploy.json).

## Security and actual measured operation

The hosted security harness passed before any product testing. Anonymous home/JS/favicon/API/auth requests returned 403. Invalid/spoofed/expired staging credentials were denied. Valid staging credentials produced an HttpOnly/Secure/SameSite=Strict cookie and the exact expected static asset bytes. Signed-out protected-page redirection stayed on the trusted origin with the correct login destination. Missing application sessions returned 401. All four internal Worker public URLs returned 404. [Executed checks](reports/firebase-cpu-hosted/security.json).

One new synthetic `example.invalid` account registered through the official Firebase SDK; no verification/reset email was sent. Its genuine Google-issued token established the D1-backed application identity/session. The fixture and credentials remain in the existing restricted private directory, outside source control. The synthetic Firebase/D1 account remains present because application testing stopped before logout/deletion; no existing accounts were deleted. No raw tokens, passwords, cookies, user emails or provider payloads appear in committed evidence.

| Measured first exchange | Result |
| --- | --- |
| Route | `POST /api/auth/firebase/session` |
| API CPU, actual Cloudflare trace-v1 `cpuTime` | **40 ms** |
| Web CPU, actual Cloudflare trace-v1 `cpuTime` | **2 ms** |
| API / Web Cloudflare wall time | 495 / 1,021 ms — not CPU |
| Client request latency | 1,738 ms — not CPU |
| API application elapsed time | 436 ms — not CPU |
| HTTP / event outcomes | Both 200 / ok; no exception names |
| D1 calls / SQL statements | **7 / 14**, compared with prior 9 / 18 |
| D1 rows read / written | **7 / 21**, compared with prior 12 / 24 |
| Password Worker invocations | **0** in the measurement window |
| R2 reads / writes | **0 / 0** |

The fresh key-fetch span confirms a first identity-exchange/key-fetch sample; module cold-start status is not independently established. The API threshold breach triggered exposure disable before another application request. Repeated samples were planned, but the mandatory first-failure stop took precedence. One failing sample is sufficient to withhold qualification; one successful response cannot establish it. [Sanitized actual traces and operation record](reports/firebase-cpu-hosted/measured-authentication.json).

## Attribution: what is established and what remains unknown

The remaining cost is established at the **API identity-exchange invocation**, not the Web proxy or Argon2id Worker. The optimized web exchange contains no `session.sign` stage and no discarded access JWT. Reduced D1 calls/statements are confirmed remotely. Neither fact proves which component consumes most CPU.

| Recorded stage | Elapsed ms (NOT CPU) |
| --- | ---: |
| Key fetch / public-key resolution / inclusive JWT verification | 90 / 90 / 90, overlapping |
| Additional Firebase claims | 0 |
| Live provider account/revocation lookup | 105 |
| D1 revocation checks | 56 |
| D1 provisioning | 132 |
| Session encryption | 0 |
| Atomic session creation | 53 |
| Middleware / request parse / JSON construction | 0 / 0 / 0 |

These timers advance at I/O boundaries and include waits. Zero does not mean zero CPU; nested spans cannot be summed. The 132 ms provisioning span is elapsed D1 work and does **not** attribute 132 ms CPU. It would be incorrect to label crypto, D1 orchestration or session processing as the dominant CPU cause from these spans.

A 3-second production CPU-profile request was launched alongside the first exchange using Cloudflare's documented profiler API. It returned **HTTP 404, code 10393, “No recent executions were found for this Worker.”** No profile was captured. No extra traffic/retry was generated to satisfy profiling after the mandatory stop. Function-level attribution therefore remains **UNATTRIBUTED**, with this precise instrumentation blocker. Cloudflare documents that profiling requires an active selected version and recent execution locations: [profiling in production](https://developers.cloudflare.com/workers/observability/profiling-in-production/). [Actual profiler response](reports/firebase-cpu-hosted/profile-attempt.json).

The next investigation should obtain a working CPU profile on the existing API version or reproduce its CPU distribution locally, then distinguish runtime/framework/config initialization, Firebase verification and key import, D1 result/orchestration and session processing. Retaining only elapsed spans or assuming RSA is expensive would not resolve this attribution gap. Security checks and hashing parameters must remain intact.

## Quota, shutdown and remaining coverage

The latest account analytics showed **398 Worker requests**, leaving **99,602** daily requests in that snapshot. Available staging analytics had zero errors; the account's five unrelated scheduler errors predated this test and were unchanged. The measured exchange itself had no runtime exception but failed the CPU qualification threshold. Historical account quantiles mix earlier code/traffic and are not substituted for this operation's actual trace.

D1 aggregates remained at 66,303 read/2,817 written in the final snapshot despite the direct exchange's 7/21 rows, demonstrating analytics lag. Reported allocated storage remained **5,545,984 bytes** across the same ten database IDs. This is an allocation snapshot, not evidence of zero database writes. No full-day workload or quota-nearing test ran. [Final metrics](reports/firebase-cpu-hosted/metrics-final.json), [final inventory/storage](reports/firebase-cpu-hosted/account-final.json).

Exposure was disabled and read back at 16:49:39 UTC. All five Workers were then independently checked private with previews disabled and schedules empty. Temporary API/Web/password tail sessions were closed/deleted, and listing confirmed **zero active tails**. The unrelated Worker and three undeployed staging Workers retained their original modification metadata. [Disable receipt](reports/firebase-cpu-hosted/exposure-disable.json), [final settings](reports/firebase-cpu-hosted/workers-final.json), [telemetry cleanup](reports/firebase-cpu-hosted/telemetry-final.json), [summary](reports/firebase-cpu-hosted/summary.json).

Session lookup CPU, refresh, logout/revocation, invalid/expired Firebase-token rejection, authenticated SSR, global NFL feed, native/device validation and broader product/recovery checks are **UNVERIFIED in this retest**. Earlier local tests remain supporting evidence only. No security weakening, billing activation, paid CPU increase, new Cloudflare resource, production/Vercel/downdistance.com change or provider switch occurred. Staging stays disabled pending a new reviewed remediation and authorization.
