# Firebase hosted staging results — October 20, 2026

**Controlled beta readiness: NO-GO.** The reviewed Firebase integration was deployed to the existing staging API/Web Workers, and real Firebase identity exchange succeeded. The first measured exchange consumed **47 ms actual Cloudflare API Worker CPU**, exceeding the **10 ms Workers Free allowance**. Staging exposure was immediately disabled at **11:07:07 a.m. CDT (16:07:07 UTC)** and application testing stopped. All five staging Workers are now verified private, preview URLs disabled and Cron schedules empty.

| Required result | Result |
| --- | --- |
| Firebase configuration | **PASS.** Actual registered Web app configuration retrieved from the authorized console, supplied through existing private staging secret files, and successfully used to validate a real Firebase-issued token |
| Spark plan verified | **YES.** Firebase console reports Spark / No-cost ($0/month). Cloudflare dashboard independently reports Workers Free as Current plan, with 10 ms/request. No billing/Blaze or paid service activated |
| Registration | **PASS functional only.** One synthetic Firebase account registered successfully; the registration-related app identity exchange returned 200 and created a D1 application UUID/session. CPU qualification fails separately |
| Login | **UNVERIFIED.** Separate email/password sign-in and invalid-password testing were not run after the CPU stop |
| Session persistence | **UNVERIFIED.** Initial D1-backed session issuance succeeded; reload/restart/refresh/expiration/revocation testing stopped before execution |
| Authenticated SSR | **UNVERIFIED hosted.** Signed-out protected-page redirect/login rendering passed security checks. Signed-in homepage/Front Office/Parlay Lab/Profile checks were not run after CPU exceeded the limit. Prior local results are not substituted |
| Legacy Argon2 CPU eliminated | **PASS for the measured exchange.** Firebase mode enabled, APP_PASSWORD_ENABLED=false, zero password Worker trace events; account analytics password requests remained 12 before/after. Legacy code retained unchanged for rollback |
| Hosted Worker CPU | **FAIL.** POST /api/auth/firebase/session: API Worker **47 ms CPU**, HTTP 200, outcome ok; **4.7×** the 10 ms allowance. One sample only; no warmed-only result substituted |
| Global NFL feed | **UNVERIFIED in this deployment.** No fresh hosted retest after mandatory CPU stop; previous local routing fix preserved |
| Product smoke tests | **NOT RUN after CPU stop.** All 32 teams, The Beat, Film Room, Three & Out, Trivia, Move the Chains, Front Office, Parlay Lab, Trending Props, Bet Slip, saved content/bets, cross-shard references and account deletion remain unqualified for this deployment |
| D1 quota usage | Latest account analytics: **66,285 rows read / 2,787 written**, corresponding to **4,933,715 read / 97,213 write rows remaining** in that snapshot. Aggregation lag means these are not an exact final run total. Measured exchange returned **9 D1 calls / 18 statements / 12 rows read / 24 written**. Pre-run storage across ten DBs: **5,525,504 bytes**; final storage not remeasured after stop |
| Security | **PASS for executed hosted access checks.** Anonymous/invalid/expired/spoofed credentials denied; assets/APIs protected; authorized exact asset bytes and safe signed-out redirects pass; internal Worker URLs denied. Real token signature/issuer/audience/expiry/UID and available revocation metadata verified. Broader wrong-token, refresh/reset/revocation and cross-user tests remain UNVERIFIED after stop |
| Remaining blockers | Firebase app identity exchange still exceeds Workers Free CPU; component-level CPU attribution not measured; remaining hosted auth/SSR/product/isolation/deletion tests; actual reset delivery/action/recovery; hosted recovery capacity; native device validation |
| Controlled beta readiness | **NO-GO** |
| Next owner action | Keep staging exposure disabled. Authorize focused CPU profiling/remediation of the Firebase exchange path, preserving signature/revocation/ownership checks and no billing, followed by a new bounded hosted run including cold verification and authenticated SSR. Do not replace this result with local/warmed timing or increase CPU limits |
| Branch | `release/down-distance-firebase-auth` |
| Commit | Activation/evidence: **19d3e5baf9b1** (baseline **0377d9c7**). This report is committed in the following documentation commit; `git rev-parse HEAD` identifies the complete deliverable |

## Verified configuration and isolated deployment

The existing Firebase project is `down-and-distance-8526c`; its real registered Web app ID is `1:953719724874:web:a5d1a0d02ad191166b7fb3` and Auth domain is `down-and-distance-8526c.firebaseapp.com`. Email/Password was verified enabled, with no other provider listed enabled. Public SDK configuration was read directly from the completed Web registration; no project IDs or credentials were invented. The API key and all existing staging secret values remain outside source control in restricted existing private staging files. No service-account/Admin key was created or used.

Firebase authorized domains currently include localhost and the project's own firebaseapp.com/web.app domains. No OAuth providers or app-directed email action URLs are used by the reviewed email/password/default Firebase reset-handler path, so no OAuth domain expansion was required. No domain, Firebase provider, billing, existing Android registration, Vercel or downdistance.com setting was changed. Actual password-reset delivery remains untested; application email/push/AI/sportsbook providers remain disabled.

The existing Wrangler OAuth session was refreshed through the official CLI after the initial direct reads returned expired-token 401 responses. The refreshed session identified the intended Cloudflare account `6e8c301360ab628706dcf3acf55f0dbb`. The subscriptions API remained permission-denied (403); Workers Free was therefore verified through the signed-in dashboard's Current plan, rather than inferred from that API. A transient rate-limit response was not treated as quota evidence. Subsequent account/settings/inventory and analytics reads succeeded.

All ten expected database IDs/names were matched against the reviewed manifest. All five existing staging Workers were verified private with no schedules and no R2/Hyperdrive/production bindings before modification. The unrelated existing scheduler was read only through account analytics and not changed. The original staging access expiry, October 22, 2026 at 12:20:33 UTC, was preserved.

Only `0010_firebase_auth.sql` was pending for the existing D1_USERS database. It was applied additively; no existing accounts/data were deleted or migrated. Only staging API/Web were uploaded, with Firebase enabled, legacy password execution disabled, provider/ingestion/mail flags off and exposure private throughout upload. The other three Workers were not deployed or recreated.

| Existing staging Worker | Deployed version |
| --- | --- |
| down-distance-rc3-staging-api | 07fda894-e4bd-4ec0-b929-88e5b31e5631 |
| down-distance-rc3-staging-web | 063f7456-4c3f-484f-8eb7-e26c49b5d363 |

Evidence: [configuration](reports/firebase-hosted/configuration.json), [inventory](reports/firebase-hosted/account-before.json), [private preflight](reports/firebase-hosted/workers-before.json), [migration list](reports/firebase-hosted/migrations-pending.log), [migration result](reports/firebase-hosted/migration-apply.log), [deployment records](reports/firebase-hosted/deployments.json), [API upload](reports/firebase-hosted/deploy-api.log), [Web upload](reports/firebase-hosted/deploy-web.log).

## Hosted security and real identity evidence

The existing credential-protected Web endpoint was enabled only after fresh private settings, gate/asset/API bindings and access expiry were checked. The existing reviewed access harness then passed anonymous home/static JS/favicon/API/auth denial, invalid/expired cookie denial, spoofed-certificate/header rejection, invalid credential rejection, authorized credential cookie attributes, exact static asset hash, safe signed-out redirects/login rendering, missing product-session rejection and denial of all four internal public Worker URLs. See [hosted security evidence](reports/firebase-hosted/security.json).

One new synthetic account at an example.invalid address was registered with Firebase. A real Google-signed token passed RS256 signature, exact issuer/audience, expiration, UID and public accounts:lookup revocation metadata checks. The real provider returns validSince; the implementation did not skip that requirement. No raw password, ID token, refresh token, cookie or provider passwordHash value was recorded in evidence. [Provider preflight](reports/firebase-hosted/provider-preflight.json) lists field names only. Existing owner accounts were preserved. The new synthetic Firebase/D1 account remains isolated; deletion testing was not performed after the CPU stop.

## CPU failure and mandatory stop

At **11:07:04 a.m. CDT**, the first registration-related `POST /api/auth/firebase/session` returned 200. Cloudflare's live tail trace-v1 reported:

| Measurement | Actual result |
| --- | --- |
| API Worker CPU | **47 ms** |
| Cloudflare event outcome | ok |
| Response | HTTP 200 |
| Cloudflare event wall time | 708 ms — **not CPU** |
| Application wall time | 632 ms — **not CPU** |
| D1 calls / statements | 9 / 18 |
| D1 rows read / written | 12 / 24 |
| R2 reads / writes | 0 / 0 |
| Password Worker events during measured window | 0 |

The exact observed blocker is the **Firebase identity-exchange API invocation**, not the old password Worker. Its path includes Google public-key verification, online account/revocation lookup, stable UID/D1 mapping and initial app-session signing/encryption. This trace does **not** attribute the 47 ms among those components or distinguish module/cold-key startup costs; identifying a single cryptographic/database function as the cause would be unmeasured. No further warm/cold retries, signed-in SSR requests or smoke tests were run to mask or work around the first failure.

Immediately after this result, the Web subdomain and previews were disabled and read back. Temporary telemetry tails were closed/deleted; no application tests followed. Only final read-only settings/quota evidence was collected. The successful HTTP response and zero runtime errors do not qualify CPU. [Actual sanitized trace and stop reason](reports/firebase-hosted/measured-authentication.json), [verified disable time](reports/firebase-hosted/exposure-disable.json), [all five final private settings](reports/firebase-hosted/workers-final.json).

## Quota and coverage limits

Account snapshots cover the current UTC day and include earlier work/unrelated scheduler traffic. The final available aggregate contains 378 Worker requests account-wide (99,622 of the 100,000 allowance remaining in that snapshot), including 12 historical password Worker requests both before and after this run. Staging Web/API requests increased by 18/3 in the available aggregates. Those aggregates lag: the reported change of 24 D1 read rows and 11 written rows does not include all 24 direct exchange writes and must not be presented as a reconciled run total. No full-day workload occurred. [Before](reports/firebase-hosted/metrics-before.json), [final available snapshot](reports/firebase-hosted/metrics-final.json), [summary](reports/firebase-hosted/summary.json).

No fresh native build/device run or broad local regression was needed for these configuration-only activation changes; the reviewed baseline bundle hashes were verified before deployment. Prior local tests remain historical support, not hosted results. Hosted recovery is still UNVERIFIED; no occupied database was deleted/restored and no new capacity was created. No paid fallback, hashing weakening, CPU limit increase, architecture redesign, production deployment or production data change occurred.

The existing Firebase configuration remains installed on private staging for the next reviewed remediation; checked-in worker exposure remains false. The next run must first verify quota/access-window freshness and retain the same fail-closed security checks.
