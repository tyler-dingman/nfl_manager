# Firebase authentication CPU diagnosis

**Final decision: NO-GO for the current authentication path on Workers Free.** The latest actual hosted API CPU remains **40 ms**, against 10 ms/request; no deployment or hosted retest occurred in this mission. Local profiling now works on the exact deployed API bundle. It identifies a substantial distributed first-use penalty, rather than proving a single slow RSA operation. An exact function-by-function allocation of the historical hosted 40 ms remains **UNVERIFIED**.

| Required item | Result |
| --- | --- |
| Profiling failure cause | Hosted discovery/readiness failure: the profiler returned 404/code 10393 before the target exchange began. No eligible execution location was found; no CPU profile existed to analyze. The timing race is confirmed, but why earlier security requests were not discoverable is unresolved. Local CLI startup profiling separately cannot reproduce the PASSWORD_SERVICE binding; a direct local API-isolate profiler and lazy-import control work |
| Profiling status | **PASS locally**: 61 standard V8 `.cpuprofile` captures, including unchanged production-bundle exchange requests and a separate module-startup control. **UNVERIFIED hosted**: no new Cloudflare capture, request or deployment |
| CPU breakdown | Three cold requests: 446 non-idle statistical samples; JWT/key/claim stacks 30.3%, auth/session orchestration 19.7%, GC 13.0%, D1 client/storage 13.0%, framework/request/runtime 10.8%, remaining categories 13.2%. These are local sample shares, **not billed milliseconds or a division of 40 ms** |
| Dominant operation | The reproducible **cold first-use path**, distributed across verification/key import, auth/public-user projection, runtime/framework work and GC. No single category is a majority. For 48 warm web requests, D1 client/storage orchestration is the largest category at 30.8% |
| Evidence-backed optimization | **No production optimization implemented.** The existing parsed-key cache works; one key fetch per isolate, one signature-verification stage and one live provider lookup per exchange. Web access-JWT signing is already absent. No additional safe change has demonstrated the roughly 75% reduction needed from 40 to 10 ms |
| Estimated Free compatibility | **Not qualified; unsuitable to release in its current measured form.** Warm local results cannot guarantee cold/rotating-key/evicted-isolate behavior on Cloudflare. This does not prove that every possible Firebase implementation is incompatible with Workers Free |
| Alternative if incompatible | For separately approved **staging evaluation**, move auth/API and authenticated SSR to one Render Free Node service behind the existing Cloudflare staging gate/static layer, retain Firebase Spark and the ten D1 databases through a server-only D1 REST adapter. New origin authentication and adapter atomicity require validation. Render Free is not a production-readiness solution; see limitations below |
| Tests passed | Auth/SSR/security units **23/23**; D1 Firebase lifecycle/erasure/staging gate **4/4**; redirect harness **15/15**; actual compiled local workerd/OpenNext SSR PASS; production build PASS; five Worker dry runs PASS; typecheck/format PASS |
| Remaining blockers | Exact hosted component CPU and native helper-thread accounting; a demonstrated cold-path <=10 ms result; hosted auth/SSR/product qualification; alternative execution/storage adapter and origin security not implemented or qualified |
| Recommended final decision | Keep current staging disabled and stop speculative Workers Free optimization/redeploy cycles. Review the specific staging-only Node alternative, including its availability tradeoff, before authorizing any implementation. No current controlled-beta or production GO |
| Branch | `release/down-distance-firebase-auth` |
| Commit | Baseline **7f3ef11a**. Diagnostic tools/evidence commit **37c8f072a5d5**; `git log -1 --format=%H -- FIREBASE_CPU_ROOT_CAUSE.md` identifies the completed report |

## What failed in profiling, and what now works

The previous [hosted attempt](reports/firebase-cpu-hosted/profile-attempt.json) began at **16:49:36.584 UTC** and returned **16:49:36.848 UTC**, with HTTP 404, code 10393, “No recent executions were found for this Worker.” The target API event timestamp in the [actual trace](reports/firebase-cpu-hosted/measured-authentication.json) is **16:49:37.291 UTC**: the error had already returned **443 ms before** the exchange started. The 3-second requested duration never became a capture window. This is a profiler execution-discovery problem, not a profile showing that cryptography cost zero or a permission/billing requirement.

The runner launched the capture concurrently with the first exchange, without waiting for an eligible target isolate/version/location. Earlier security requests existed, so timing alone does not prove why the discovery system found none. A future hosted capture would need explicit deployed-version selection and verified recent/active target execution before capture, with traffic overlapping its window. This was not attempted here: deployment and hosted testing were not authorized. The CPU stop rule must not be bypassed just to warm an isolate. Cloudflare documents the active-version/traffic requirement in [production profiling](https://developers.cloudflare.com/workers/observability/profiling-in-production/).

The historical local internal-startup error could not be reproduced with the minimal explicit configuration: tiny-inspector, full-API-inspector and full-API-normal cases all started successfully. The new harness discovers `/json/list`, attaches to the exact **core:user:api** WebSocket, enables Profiler before fixture requests and closes it before disposing the runtime. This provides a working reproduction rather than claiming the old opaque runtime error has a proven root cause. [Final probe](reports/firebase-cpu-root-cause/inspector-probe.json).

Wrangler's separate local startup command was also inspected and tried. Its supported dry-run multipart input reached analysis but failed because its generic startup harness cannot reproduce **PASSWORD_SERVICE**. An initial raw-JS input was rejected as non-multipart; changing to the required dry-run input exposed the actual service-binding limitation. The working local workaround is a **diagnostic-only lazy-import wrapper**, with the real API module and synthetic bindings, profiled before module import. No wrapper/diagnostic route is part of application routing. [CLI diagnostic](reports/firebase-cpu-root-cause/startup-profile.log), [successful separate startup/exchange capture](reports/firebase-cpu-root-cause/lazy-module/workerd-profile-summary.json).

## Measurement boundaries

The source-map build produces a byte-identical API bundle, SHA-256 **5754d5640647706d6d45c608407a3b29e0d605c8d145e5ffed5289545ac82e26**, matching the deployed/local candidate. External source maps contain no embedded source text, and the summarizer checks the bundle match. Thus the profiles refer to the **existing implementation**, not an alternate authentication algorithm. [Hash verification](reports/firebase-cpu-root-cause/source-map-check.log).

Three fresh workerd isolates produced the main comparison: three first exchanges, 48 warm web exchanges and three native exchanges. The optional module-control run added six exchanges and one startup capture. Each isolate used ten disposable D1 fixtures and synthetic RSA tokens; all Google key/account replies were intercepted. There was one key fetch per isolate and one fresh provider account lookup per exchange. The first/new web exchanges retained seven D1 calls and fourteen SQL statements. No valid-identity/revocation decision was cached.

V8 sample **counts** identify executing synchronous stacks statistically. They are not exact per-stage CPU clocks. Sampling gaps and parked time make `timeDeltas` unsuitable for converting this run to billable CPU; the reports use counts and explicitly separate idle samples. Categories are derived from the nearest recognizable mapped synchronous frame, not full async causal traces. Native helper-thread crypto work and D1's separate SQL engine are outside the profiled API isolate. Some native/program frames remain unattributed. The profiler itself adds overhead. None of these limitations is hidden by presenting elapsed time as CPU.

The existing numeric request-local timings cover verification, key retrieval/resolution, additional claims, live provider lookup, D1 revocation/provisioning, session creation/encryption/signing, request parsing and JSON construction. The Node control harness separately wraps the real repository's user lookup methods. Records contain fixed operation/method names and numeric counters only—no tokens, secrets, SQL bind values, email addresses or provider payloads. Raw CPU profiles contain function/source positions, not argument values.

## CPU breakdown and dominant cost

| Local API-isolate sample category | Three cold exchanges | 48 warm web exchanges |
| --- | ---: | ---: |
| Crypto/JWT stacks | 87 / 19.5% | 104 / 13.0% |
| Key retrieval/import/parsing stacks | 45 / 10.1% | 3 / 0.4% |
| JWT claim validation/decoding stacks | 3 / 0.7% | 8 / 1.0% |
| Auth/session orchestration, including public-user projection | 88 / 19.7% | 84 / 10.5% |
| D1 client/storage orchestration | 58 / 13.0% | 247 / 30.8% |
| Framework/request/runtime | 48 / 10.8% | 118 / 14.7% |
| Garbage collection | 58 / 13.0% | 51 / 6.4% |
| Configuration | 4 / 0.9% | 37 / 4.6% |
| Other / unattributed native/program | 55 / 12.3% | 150 / 18.7% |
| Total non-idle samples | **446** | **802** |

Median non-idle sample counts were **126 per cold request** versus **15.5 per warm web request**, about **8.1×**. This is a local first-use signal, not an 8.1× hosted CPU estimate. The cold and warm new-user paths retain the same D1 statement shape, while the key cache removes subsequent retrieval/import work.

Across cold captures, prominent self-sample locations include native `importKey` (27), `verifyFirebaseSignature` (25), the `toPublicUser` projection in `postgres-repository.ts` (19), native `verify` (11), and GC (58). The projection is shared mapping code; **no PostgreSQL call occurs**. Samples at a function entry can include first-use compilation/runtime costs, so these counts do not mean the small mapping expression intrinsically requires milliseconds on every request. [Raw profiles and mapped summaries](reports/firebase-cpu-root-cause/mapped-profile-summary.json), [aggregate and category rules](reports/firebase-cpu-root-cause/aggregate-profile.json), [summarizer](scripts/firebase-auth/summarize-profiles.mjs).

The remaining warm cost is distributed too, with D1 client/result/write-fence orchestration the largest sampled family. **D1 wait is not D1 CPU.** The previous hosted elapsed spans—90 ms inclusive verification/key retrieval, 105 ms provider lookup, 56 ms D1 revocation, 132 ms provisioning and 53 ms session creation—include I/O. They cannot allocate the actual 40 ms CPU among those operations. Nor can these local sample percentages be multiplied by 40 to invent a hosted breakdown.

### Independent component controls

The actual functions were also measured in sequential **Node process.cpuUsage** batches. These controls include Node crypto helper-thread CPU but are **not workerd/Cloudflare CPU**; fixture D1 RPC transport adds Node overhead absent from native D1 bindings.

| Existing operation | Mean local Node CPU per call |
| --- | ---: |
| Import public JWK, no network | 0.0343 ms |
| `verifyFirebaseSignature`, imported key, all standard/additional claims | 0.0893 ms |
| AES-GCM `encryptSecret`, including key derivation/randomness | 0.0219 ms |
| `secureToken(48)` | 0.0116 ms |
| NextResponse JSON construction control | 0.0300 ms |
| Actual opaque session cookie serialization | 0.0152 ms |
| Empty async-loop control | 0.0002 ms |

Five batches per microbenchmark were retained; these are means, not hosted budgets. In complete Node fixture exchanges, warm inclusive verification averaged 0.193–0.208 ms and additional Firebase checks 0.003–0.004 ms. Repository lookup wrappers averaged 2.748 ms for findUserById and 1.261 ms for findUserByEmail, **including Node fixture transport**. Provisioning/session creation were separately recorded but nested spans overlap; they must not be summed as exclusive CPU. [Full component/batch data](reports/firebase-cpu-root-cause/component-cpu.json).

**Cookie signing is not an API-exchange operation.** The app cookie carries a random opaque session token backed by a hashed D1 session. Its serialization is measured above. The separate staging-access cookie's HMAC is in the Web gate; its last hosted hop was 2 ms. Native app access-JWT signing is preserved; web exchange signing was already removed. Blaming an API cookie signature would diagnose code that does not execute.

### Startup is a distinct boundary

The local lazy-import control captured **737 non-idle module-initialization samples**, separately from its subsequent first exchange's 116. It exposed broad API module evaluation, framework/configuration setup and eager product-data initialization; a prominent frame maps to draft-order construction in `src/server/api/store.ts:458`. The previous real API upload separately reported **Worker Startup Time: 137 ms**. [Historical upload](reports/firebase-cpu-hosted/deploy-api.log).

This module work is worth recognizing, but it is **not an allocation of the request's 40 ms**. Worker startup has a separate measurement/budget, documented under [Worker startup time](https://developers.cloudflare.com/workers/platform/limits/#worker-startup-time). This mission neither establishes that those 137 ms were billed to that invocation nor optimizes unrelated product-data initialization as an authentication fix.

## Evidence-backed solution assessment

1. **Public-key reuse already works.** One fetch/import path per local isolate, then warm resolution. Cache age/cooldown remain bounded. It cannot guarantee a warm key in every new/evicted isolate or after rotation; pinning a build-time Google key or treating a warm request as cold qualification is not a safe remedy.
2. **No duplicate verification/provider lookup was found in one exchange.** Each request still verifies signature/issuer/audience/expiration/UID, checks current provider revocation metadata and D1 tombstones, and preserves ownership. Caching successful authorization would undermine those checks.
3. **Web access-token signing was already eliminated.** Remaining encryption/randomness/cookie/JSON controls are small locally; there is no measured basis for weakening them or promising a 30 ms saving.
4. **D1 client work is measurable, but not all removable.** Atomic session/provider association, owned prior-session revocation, write fences, tombstones and deletion protection remain required. Local Node RPC costs are not evidence that removing a security lookup saves the same hosted CPU.
5. **The release problem is cold-path reliability.** The existing hosted 47 → 40 ms observations remain failures. An additional 75% reduction with headroom has not been demonstrated. No runtime/security change or speculative optimization was made in this mission.

This supports **NO-GO for the current Workers Free path**, not a claim that Firebase RS256 verification inherently takes 40 ms or that no smaller future Worker could ever fit. The exact dominant function in the historical hosted invocation remains unknown without a successful same-environment profile.

## Specific alternative, not implemented

For an owner-approved **staging-only** alternative, use **one Render Free Node web service for the existing auth/API and authenticated SSR**, retain Firebase Spark identities/credentials and the ten existing D1 databases, and keep Cloudflare Workers Static Assets plus the existing staging gate as the edge layer. A server-only D1 REST adapter would preserve the current schema and ownership/write-fence semantics; its atomic batch/rollback behavior must be proven before use. No PostgreSQL, R2 or credential migration is proposed.

The new origin would have to reject direct requests before any app/auth work unless they carry an authenticated, replay-bounded edge request. Secrets stay server-side. Revocation and erasure remain live D1/provider checks; no cached authorization assertion replaces them. This is a proposed execution-boundary change, **not completed security work**. No Render account/service was accessed or created, and no adapter or origin route was deployed.

Render documents a no-payment setup and free Node web services. Its Free plan has 750 shared monthly instance-hours, sleeps after 15 idle minutes, can take about a minute to wake, has ephemeral storage, and may suspend excessive external-database/API traffic. It explicitly advises against production use. These limits make it a **staging evaluation option**, not a production or controlled-beta GO; this owner's account eligibility/remaining quotas are unverified. Keep payment methods absent and stop rather than activate paid compute if a future approved prototype requires it. [Free service limits](https://render.com/docs/free), [no-payment setup](https://render.com/docs/your-first-deploy).

If strict no-billing and production-grade availability are both mandatory, this report does not establish a hosting option that meets both. The owner must choose the staging-only availability tradeoff or revisit the hosting requirement; authentication must not be weakened to manufacture a Workers Free pass.

## Validation, safety and final action

- [23 auth/SSR/unit tests](reports/firebase-cpu-root-cause/auth-tests.log): genuine synthetic RS256 validation; forged/expired/wrong-claim rejection, provider failure/revocation metadata and private SSR transport.
- [Four Worker lifecycle/erasure/gate tests](reports/firebase-cpu-root-cause/worker-tests.log): sessions, user isolation, UUID compatibility, revocation, atomic rollback, independent erasure ledger/restart, fail-closed access and durable gate rate limits.
- [15 redirect tests](reports/firebase-cpu-root-cause/redirect-tests.log) and [compiled local workerd/OpenNext](reports/firebase-cpu-root-cause/firebase-ssr-workerd.json): four signed-in HTML pages, missing/expired/revoked sessions, private gate and two-user isolation. Providers are intercepted; this is not hosted validation.
- [Production build](reports/firebase-cpu-root-cause/build.log), [five dry runs](reports/firebase-cpu-root-cause/update-manifest.json), [typecheck](reports/firebase-cpu-root-cause/typecheck.log), [format](reports/firebase-cpu-root-cause/format-check.log), [validation summary](reports/firebase-cpu-root-cause/validation-summary.json). Existing unrelated build warnings remain. The optional generic startup-profiler command failed as documented; direct workerd profiling passed.

Reproduction commands and measurement limitations are in [PROFILING.md](scripts/firebase-auth/PROFILING.md). Application code, configuration, JWT/Argon2id parameters, credentials, session/revocation/erasure semantics and staging access controls are unchanged. No new Cloudflare resource, billing activation, production/Vercel/downdistance.com change, native UI change, live provider call or remote application test occurred. Build font downloads and public documentation reads are not application testing. No native-device validation is claimed.

**Exact next owner action:** review this diagnosis and choose whether to authorize a local Node-runtime/D1-adapter staging prototype. Do not authorize another unchanged Workers Free deployment as a CPU qualification attempt. Staging exposure was not changed by this mission; its last remote verification remains the prior retest's private shutdown. This mission stops with local commits and no deployment.
