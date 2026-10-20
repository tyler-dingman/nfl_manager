# Hosted release blocker remediation — October 20, 2026

**Two application fixes are implemented and locally validated. Authentication CPU remains blocked. Nothing was deployed.** Existing users, password hashes, ten-D1 storage, the five staging Workers and staging access controls remain unchanged remotely. Controlled beta/production readiness remains **NO-GO**.

| Required result | Result |
| --- | --- |
| Web session verification | **LOCAL PASS; hosted retest required** |
| Global feed | **LOCAL PASS; hosted retest required** |
| Authentication CPU solution | **UNRESOLVED / NOT QUALIFIED**; unchanged Argon2id exceeds Workers Free CPU; investigated alternatives and migration gates below |
| Existing password compatibility | **PRESERVED**, no hashing/credential/session format change or user migration; native-PHC local workerd regression passed |
| Tests passed | Auth/middleware 22; ten-D1 global/team integration; security/cross-shard five; actual local workerd authentication and SSR; production/OpenNext build; five Worker dry runs; completion typecheck |
| Tests failed | **No outstanding local validation failures.** Baseline hosted password CPU remains FAIL; no fresh hosted CPU result is claimed |
| Hosted retest required | **YES**, after separate owner security/CPU review and deployment approval |
| Remaining blockers | Verified no-billing password execution/migration choice; hosted validation of the two fixes; existing wider release/recovery/integration gates remain open |
| Recommended next action | Review the two fixes and CPU decision record. Approve an isolated synthetic compatibility/security proof for an external native Argon2 executor if exact hashing must remain; alternatively review a managed-identity migration policy. Approve any staging upload separately. |
| Branch | `release/down-distance-rc3` |
| Commit | Code, tests, evidence and review plan: **a836d19a**. Final report is in the following documentation commit (`git rev-parse HEAD`) |
| Baseline | `d01e358a` |

## Evidence inspected before changes

Read [hosted results](DOWN_DISTANCE_HOSTED_STAGING_RESULTS_RC3.md), actual [authentication traces](reports/hosted-staging-rc3/completion/measured-operations.json), [SSR/product and persistence results](reports/hosted-staging-rc3/completion/persistence-and-product-metrics.json), [Worker bindings/settings](reports/hosted-staging-rc3/completion/workers-private-settings.json), and the existing middleware, Worker entry points, OpenNext request context, authentication/session repositories and editorial routing.

The baseline establishes that API sessions returned 200 while authenticated pages returned 503, global NFL lists returned 500 while team feeds worked, and password Worker CPU measured 52–200 ms against the documented Workers Free 10 ms/request allowance. This mission made no remote Cloudflare account calls or deployment. The last hosted report's disabled public exposure remains the recorded remote state; it was not represented as newly inspected here.

## Web session verification

The browser's `dd_session` is an opaque database-backed token, not a JWT that middleware can treat as a signed identity assertion. The private API already validates its digest, expiration, revocation and user status and returns the current user. Its request-scoped D1/environment/JWT configuration worked in the hosted evidence.

SSR middleware instead used global `fetch()` to the public Web origin's `/api/auth/me`, even though the Web Worker already declares the private `API_SERVICE` binding. This re-enters public Worker routing rather than using the API transport. Cloudflare documents same-zone/Worker fetch restrictions and recommends service bindings for private Worker calls. The baseline did not capture the underlying exception code, so **1042 is not claimed as an observed hosted error**. The transport mismatch is established by code inspection, and the corrected path is verified in actual local workerd. [Cloudflare restrictions](https://developers.cloudflare.com/workers/observability/errors/), [private HTTP service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/).

The smallest correction is [application-session.ts](src/lib/application-session.ts): obtain `API_SERVICE` from the current OpenNext request context and call its `/api/auth/me` directly. Forward only `dd_session`; omit the outer staging credential, unrelated cookies, bearer headers and client-supplied identity headers. The API's normal session authority and D1 ownership checks remain intact. Accept only HTTP 200 with `{ok:true,user:{id:<nonempty string>}}`; 401 means signed out. Redirects, non-200 statuses, malformed responses, missing Cloudflare service/context and exceptions fail closed through the existing 503 path. No authentication-result cache or public Cloudflare fallback is added. Non-Cloudflare Next retains its existing same-origin lookup.

The OpenNext environment is request-scoped; no Worker binding, user result or token is captured at module initialization. Tests interleave two contexts/cookies and confirm no cross-request sharing. JWT handling, login/session issuance, prelaunch/mobile behavior and repositories are unchanged. No new service binding or secret is required.

The **built staging-gated Web Worker and actual API Worker** ran together in local workerd with ten synthetic D1 stores. Anonymous requests were denied; signed-out, invalid, expired and revoked product sessions redirected to login; valid sessions rendered Home, Account, Front Office and Parlay Lab as 200 HTML with private/no-store policy. Two concurrent users returned their own IDs. **Zero outbound requests** occurred, proving SSR no longer depends on public self-fetch in this test. These are local results, not a hosted/browser/native-device pass. [SSR workerd evidence](reports/hosted-blocker-remediation/ssr-workerd.json), [probe](scripts/hosted-remediation/probe-ssr-local.mjs).

## Global NFL feed

The D1 list, paginated list and wire projections passed every identifier through `applicationTeamStorage`, whose canonical-team resolver correctly rejects `NFL`. A small public-editorial selector now sends **only the exact `NFL` identifier to `D1_SHARED`** and preserves the existing strict resolver for all teams/invalid inputs. There is no scatter/gather redesign, content copy, renumbering or database migration. [Projection change](src/server/story-engine/projections.ts).

A real synthetic ten-D1 regression publishes one story for every team plus shared NFL content, then verifies all **32 team feeds and the global HTTP handler**, list/page/wire routing, unchanged global IDs, filtered search, original-ID lookup, saved global/team references and retention pins, and another user's empty saved collection. Unknown team identifiers still reject. Existing search API semantics remain unchanged. [Global integration test](workers/content-engine/test-node/hosted-global-feed.test.ts), [passing evidence](reports/hosted-blocker-remediation/global-feed-tests.log).

## Secure Free authentication investigation

The configured password service still performs the exact existing Argon2id v19, memory 19,456 KiB, two iterations, parallelism one, 32-byte hash. No limits were raised, hashing weakened, hashes rewritten, sessions invalidated or users migrated. Successful requests above 10 ms are not qualification. The local native-PHC/workerd regression validates compatibility, **not hosted CPU**.

The [authentication options decision record](reports/hosted-blocker-remediation/authentication-options.md) contains current official sources, verified plan limits, delivery constraints and a migration/rollback gate. Findings:

- Existing Google/Apple/Facebook adapters can delegate identity verification, but no social provider is configured in the isolated staging evidence. They cannot silently replace password-only users or supply an unverified recovery flow.
- Firebase Spark has a no-payment starting plan and documented Argon2 import bounds compatible with these parameter shapes. It rehashes imported passwords after login, so preserving the current hashing policy cannot be assumed. Email-link sign-in is limited to five messages/day without billing, insufficient for a 25–50 DAU passwordless replacement. Imports, identity mapping, recovery and remaining Worker CPU still require synthetic proof.
- Auth0 Free documents 25,000 MAU and Argon2 PHC bulk imports. Its Free plan lacks custom database connections; import compatibility does not prove a complete legacy-credential migration. Managed hashing/recovery policy and actual tenant limits require review; default email is for testing.
- A stateless native Argon2 executor on a Free external host could preserve exact PHCs and D1 user/session storage. Render documents 750 monthly Free instance hours and idle spin-down/cold-start limitations. A no-card account, secure caller authentication/replay/rate controls, password-log exclusion, outage behavior and CPU/availability have not been verified. No executor was provisioned or activated.
- Supabase is not selected because it introduces a PostgreSQL-backed auth dependency and managed-hashing policy change. Cloud Run's Free Tier requires billing and is excluded. Passwordless/passkeys are not substitutes for complete enrollment, delivered authentication and recovery.

The exact blocker is **not proof that no secure Free service exists**. It is that the only configured path exceeds its CPU budget, while no alternative has a verified no-payment execution account, approved trust boundary, existing-user compatibility/migration proof, complete recovery and measured Worker CPU. No unreviewed provider or migration code was added. Preserve original D1 IDs/hashes and explicitly handle password-change authority and rollback before choosing a replacement; retaining stale hashes alone is not safe rollback after migration.

## Validation

| Check | Final result and evidence |
| --- | --- |
| Auth and middleware regression | **22/22 PASS** — includes existing auth tests, signed-out behavior, private SSR transport, credential/header filtering, malformed/backend failure and concurrent context isolation. [Log](reports/hosted-blocker-remediation/auth-regression.log) |
| Global/team integration | **PASS**, all 33 identifiers plus IDs/search/saves/isolation. [Log](reports/hosted-blocker-remediation/global-feed-tests.log) |
| Security and cross-shard regression | **5/5 PASS**, including staging gate/asset protection and existing release cross-shard cases. [Log](reports/hosted-blocker-remediation/security-cross-shard-tests.log) |
| Actual local workerd auth | **PASS**, ten scenarios: signup, native PHC, incorrect credentials, concurrent sessions, logout isolation, expiration, reset/replay, old-password rejection and restart. [Report](reports/hosted-blocker-remediation/auth-workerd/password-runtime.json) |
| Actual local workerd SSR | **PASS**, eleven recorded checks including four rendered pages, session rejection and user isolation; zero outbound network. [Report](reports/hosted-blocker-remediation/ssr-workerd.json) |
| Production build | **PASS**, Next production + OpenNext + Web dry run; existing unrelated formatting/hook/Edge warnings remain. [Log](reports/hosted-blocker-remediation/production-build.log) |
| Worker dry runs | **PASS all five existing staging configurations**, outbound sockets blocked; only API/Web need code updates. [Manifest](reports/hosted-blocker-remediation/update-manifest.json) |
| Completion TypeScript / changed-file formatting | **PASS**; [typecheck log](reports/hosted-blocker-remediation/typecheck.log) |

Initial setup checks encountered a test module-resolution/loopback environment issue, unavailable Google-font download in the restricted build, and a probe assertion that failed to resolve a valid relative Location header. These were corrected without changing product security; passing reruns are above and diagnostic logs are retained. No local test failure remains. Build font downloads were restricted to public font hosts; application/provider endpoints and credentials were excluded. No Android/iOS build/device validation or hosted retest occurred. No shared UI rendering code changed.

## Hosted update preparation and next action

The [review-only retest plan](reports/hosted-blocker-remediation/hosted-retest-plan.md) supplies exact upload commands, safety preflight, rollback boundaries and ordered checks. The [update manifest](reports/hosted-blocker-remediation/update-manifest.json) records the two bundle digests, five existing configs and assets. **Only existing staging API and Web Workers need uploads.** No schema, D1 creation, other Worker deployment, domain, ingestion or provider activation is required. Both uploads must happen while private; enabling the protected endpoint comes only after separate approval and actual account/settings read-back.

Before deployment, the owner must review the security impact above and explicitly accept that CPU remains unresolved or authorize a separately verified CPU approach. The next hosted checks must cover staging denials first, then signed-in/signed-out/expired/invalid/revoked pages, all 32/global feeds and original IDs, user isolation, and actual CPU/query/quota metrics for every relevant hop. Any bypass/unexpected exposure requires immediate disable and remote stop. Keep all schedules/providers off and preserve the ten occupied databases/independent erasure ledger; no destructive restore or production action is authorized.

**No deployment, billing activation, R2 activation, paid service, background ingestion, production change or credential migration occurred.** Staging remains untouched by this mission. These changes are committed locally for review; the CPU blocker and hosted retest prevent release approval.
