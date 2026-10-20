# Render + Cloudflare hosted staging results

**NO-GO. The hybrid staging deployment succeeded, but a native-D1 API gateway invocation used 58 ms CPU during Front Office creation, exceeding the Workers Free 10 ms target. Testing stopped immediately. Cloudflare staging exposure is disabled and Render is suspended.** No billing, paid service, production deployment or new Cloudflare resource was activated.

## Required results

| Result | Measured status |
| --- | --- |
| Render service created | Existing owner-created Free `nfl_manager`, `srv-dbbsht6i0phs73e2otg0`, reused; no second service |
| Render Free verified | YES, Free Node service / Hobby workspace; no card on file, rechecked after suspension |
| Billing activated | NONE |
| Origin security | PASS sampled direct, missing, forged, expired and replay denial; strict origin/body/audience binding retained |
| Cloudflare gateway | Native binding boundary deployed on existing Web/API Workers; internal Workers remain private. Local rollback/CAS/fence tests PASS; hosted rollback/concurrency testing UNVERIFIED |
| Firebase authentication | Registration, identity exchange, repeated refresh, API session lookup, login/logout and revoked-session denial PASS in bounded samples. One separate fresh login failed closed during D1 revocation read; subsequent retest passed; transport cause unresolved. Full authentication reliability UNQUALIFIED |
| Authenticated SSR | Homepage, Front Office, Parlay Lab, account and additional product HTML returned 200. Signed-out homepage redirected 307 to same-origin login, which returned 200. Full signed-in browser validation interrupted/unqualified |
| All-team routing | PASS: 32/32 feeds contained their existing `rc3-qualification-TEAM` synthetic identities |
| Global feed | PASS: shared NFL feed returned 200 with `rc3-qualification-NFL` |
| Cloudflare gateway CPU | FAIL: Web 0–4 ms (318 samples); API 0–58 ms (202 samples). Actual Cloudflare live-tail CPU, not latency |
| Render memory | Actual Node process RSS 300,945,408–312,217,600 bytes in initial auth snapshots (~287–298 MiB). Not a concurrency/capacity qualification |
| Cold-start behavior | Initial deployment logs: Node start 15:34:13 CDT, listening 15:34:21, platform live 15:34:29 on October 20, 2026. Sleep/wake and restart persistence NOT RUN after CPU stop; deployment timing is not a sleep/wake measurement |
| D1 usage | Snapshot 124,819 rows read, 7,403 written; 2,231 read queries / 3,682 write queries; 5,566,464 bytes across ten databases. Analytics may lag final traffic |
| Product smoke tests | PARTIAL / FAIL overall. Cross-shard saved articles, saved bet readback, saved-content isolation, deterministic search and bounded Parlay routes passed. Front Office creation triggered CPU stop; Three & Out has no verified edition; Huddle API is intentionally disabled |
| Hosted recovery | UNVERIFIED: ten occupied slots, no safe empty isolated restore capacity; no database deleted, overwritten or restored |
| Remaining blockers | Native gateway CPU; unresolved intermittent D1-read failure; Three & Out edition availability; intentionally disabled Huddle; incomplete browser, Front Office, erasure, persistence and recovery qualification |
| Controlled beta readiness | NO-GO |
| Exact next owner action | Keep staging disabled. Review this 58 ms native-gateway trace and authorize focused local profiling of the Front Office transaction path before another hosted retest. Preserve native batch atomicity, write fences and identity security; inspect the interrupted synthetic command journal before retrying its mutation |
| Branch | `staging/render-cloudflare-hosted-preflight` |
| Commit | Render deployed `d12ecd5fac73ff560c492c06a57e67a4b55febfc`; Web-only form correction `fd62b6bc`. Final report commit: `git log -1 --format=%H -- RENDER_CLOUDFLARE_HOSTED_STAGING_RESULTS.md` |

## CPU failure and transaction integrity

[The final trace](reports/render-cloudflare-hosted/completion-validation.json) identifies **`down-distance-rc3-staging-api`, `/__staging/transaction`, during `POST /api/saves/create` (Front Office native durable creation)**. That invocation reported CPU **58 ms**, wall time **144 ms**, HTTP **200**, outcome **ok**, no exception. A successful response or platform burst allowance does not qualify it for the 10 ms Free budget. Another native invocation reached 9 ms; the workload lacks consistent headroom.

The safety monitor disabled the Web endpoint as soon as the over-limit trace arrived. The enclosing Front Office request returned 503 after 5,239 ms. Shutdown can interrupt later steps, so this does **not** prove the native batch rolled back or the entire application command failed before writing. Its workflow outcome is ambiguous; no automatic retry, destructive cleanup or recovery was attempted. Existing per-database native batches remain intact; no REST writes or non-atomic sequential substitute was introduced.

The API Worker executes transport verification, command validation, bound native D1 operations and result serialization. It does not execute Firebase JWT verification or Argon2id. The exact division of 58 ms among gateway parsing/validation, native D1 driver work and result encoding was **not captured**. Do not assume a specific dominant component without profiling. Do not weaken authentication, split an atomic batch, raise paid CPU limits or introduce another provider as an unmeasured workaround.

The initial auth phase independently captured 63 Web and 39 API samples, all 0–3 ms. This is evidence that the sampled Firebase exchange/session path improved over the prior 47/40 ms application Worker observations. It does not qualify the heavier Front Office path or total daily capacity. A user operation now creates multiple gateway invocations; per-invocation CPU is distinct from aggregate CPU/request amplification.

Node observation snapshots include numeric RSS/heap and cumulative `process.cpuUsage()`. Their CPU delta includes all process activity in the interval and is not Cloudflare CPU or Render billed CPU. Stage `elapsedMs` and HTTP latencies include I/O and are not CPU measurements.

## Security and the browser form correction

Hosted denial checks passed for direct origin pages/assets/APIs, anonymous edge pages/assets/APIs, invalid gate credentials, forged/expired/replayed transport assertions and internal Worker URLs. No bypass was observed. Normal user requests cannot access the separate operator runtime-observation audience. Headers remain private/no-store, including origin static chunks.

Chrome initially submitted the staging credential form with `Origin: null`; the strict CSRF gate rejected it with 403. `Referrer-Policy: no-referrer` causes this behavior for ordinary form POSTs. [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header). The reviewed correction changes only this staging response policy to `same-origin`; null and untrusted origins still fail. Four focused local workerd/origin tests and a Web dry run passed before redeployment.

After the correction, actual Chrome form submission sent the canonical staging Origin and received 303, then rendered the login page. Email sign-in controls loaded. The attempted application sign-in displayed an inability-to-establish-session message during the CPU shutdown; signed-in browser behavior is **UNQUALIFIED**, not PASS. No bypass was used to establish a browser cookie. Android/iOS were not built or device-validated; React Native screens were unchanged.

## Bounded product results

- PASS: all 32 synthetic team feeds, global NFL identities, authorized edge logo asset, homepage/Beat/Film Room/Three & Out/Huddle/Trivia/Front Office/Parlay/Trending Props/My Plays/account HTML responses. These HTML checks do not prove every interactive workflow.
- PASS sampled: Firebase registration/exchange/refresh/session lookup/logout/revocation; invalid Firebase token rejection; saved articles spanning KC, BUF and NFL; synthetic saved bet; cross-user saved-content isolation; deterministic search. No live provider functionality is inferred from fixtures.
- PASS bounded Parlay endpoint responses: events, props, movement and freshness, with external providers disabled; empty/fixture responses are not live sportsbook validation.
- PARTIAL: Trivia daily endpoint/page returned 200; gameplay/progress and Move the Chains were not completed. `/game-day` rendering is not a Move the Chains qualification.
- UNAVAILABLE: Three & Out API explicitly returned 503 because no verified edition was available. Huddle API explicitly returns 503 as an intentionally disabled visual concept; no new backend or provider was enabled.
- FAIL / STOP: Front Office durable creation exceeded API CPU. Hosted idempotent replay, foreign-owner Front Office access, final account-deletion journal, restart/sleep persistence and the remaining dependent tests were not executed. Prior local passes are not hosted results.

The earlier fresh-login 401 occurred after signature/claim/provider checks passed and during a failed D1 revocation lookup, before provisioning or session creation. Read-only diagnosis found no tombstone; one retest after a propagation wait passed. The transport cause remains unresolved. No auth decision was cached or bypassed to proceed. Failed attempts remain in the evidence.

Synthetic accounts, saved content and possible interrupted Front Office records remain isolated in staging. Account-deletion testing was not reached; no account-erasure PASS is claimed. Preserve the independent erasure ledger and inspect command/journal state before any future cleanup or replay. No occupied database may be deleted to obtain recovery capacity.

## Account, quotas and final shutdown

Cloudflare Workers Free and Firebase Spark were verified in their dashboards during preflight. The ten D1 IDs matched `config/render-staging/databases.json`; existing five staging Workers were reused. The unrelated scheduler was not modified. Subscription API 403 is an API permission limitation; plan verification came from the dashboard, not an invented subscription response. D1 engine metadata containing `production` is not an application production binding.

Actual account snapshots (not a full-day workload):

| Metric | Before | Final snapshot | Delta |
| --- | ---: | ---: | ---: |
| D1 rows read | 66,316 | 124,819 | 58,503 |
| D1 rows written | 2,844 | 7,403 | 4,559 |
| D1 read queries | 1,098 | 2,231 | 1,133 |
| D1 write queries | 1,231 | 3,682 | 2,451 |
| Worker requests | 401 | 1,755 | 1,354 |
| Worker platform errors | 7 | 7 | 0 |

Snapshot time: `2026-10-20T21:00:05.178Z`. Analytics may lag; these are account-wide totals, not exclusively test traffic. Snapshot headroom: 98,245 Worker requests, 4,875,181 D1 rows read, 92,597 D1 rows written. No quota exhaustion occurred. No 25–50 DAU or full-day ingestion capacity claim is made.

[Application stage metrics](reports/render-cloudflare-hosted/render-auth-stage-metrics.json) contain actual D1 call/statement/row counts for sampled API operations. Web replay claims use four statements and native batches are capped at 50 by code; those ceilings are not measured query counts for the 58 ms invocation. Exact per-invocation D1/query/result-byte attribution for that failure remains a profiling gap. HTTP denials and product 503 responses are distinct from platform exception/error counters.

Render's final UI still shows Hobby, no card on file, 4/500 pipeline minutes, and rounded 0/750 hours and 0 MB/5 GB bandwidth. Rounded zero does not mean no runtime/traffic was consumed. Free external API/database traffic suspension restrictions remain a feasibility risk; no sustained workload was run. [Render Free limits](https://render.com/docs/free).

Final readback: **all five staging Workers private, previews off, empty Cron schedules; zero active tail sessions on all five; Render suspended, auto-deploy off**. No public staging exposure is left enabled. Email, AI, push, sportsbook calls and ingestion remain disabled. Firebase identity calls were the only enabled external application identity integration. No production DNS, downdistance.com, Vercel, production account/data or billing setting was modified.

## Local validation and publication

Current local evidence: 78 native-boundary integration assertions PASS; initial five focused native/security tests PASS; four focused form-correction security tests PASS; TypeScript PASS; portable Node production build PASS; actual Render Linux build PASS; API/Web dry runs PASS and corrected Web dry run PASS. The first form regression run used an old fixture bundle and failed; rebuilding the local fixture produced four passes. An initial hosted harness import failed before application testing; staging was disabled, the import was locally verified, and an independent outer cleanup guard was added. No production or device build result is inferred.

Owner approved public publication after audit. Official checksum-verified Gitleaks v8.30.1 scanned all 566 reachable commits at `1897667c`: 94 findings individually classified as checksums/UUIDs/prose/offline test fixtures/public registered Firebase client config, zero unresolved. Exact matching of 18 known private credentials against 10,117 reachable blobs found no matches. New staged source/evidence was separately scanned before publication. [Audit evidence](reports/render-cloudflare-hosted/secret-audit.json). Scanning cannot guarantee absence of every unknown credential.

Private environment files and account tokens remain outside source control. The earlier bulk editor exposed staging values in the private tool transcript before masking; no raw editor screenshot or credential value was published. Subsequent UI observations were masked/redacted. No production secret was used.

Runtime dependency advisories remain documented: critical shell-quote/tar paths originate in installed React Native/Expo tooling outside the Node start path; other advisories also remain. This is not a clean dependency audit or beta-readiness PASS. No broad dependency/native upgrade was attempted during the staging mission.

Evidence index: [summary](reports/render-cloudflare-hosted/final-summary.json), [auth CPU](reports/render-cloudflare-hosted/hosted-validation.json), [32-team product phase](reports/render-cloudflare-hosted/product-validation.json), [CPU stop](reports/render-cloudflare-hosted/completion-validation.json), [final Workers](reports/render-cloudflare-hosted/workers-final.json), [final account](reports/render-cloudflare-hosted/cloudflare-account-final.json), [final quotas](reports/render-cloudflare-hosted/metrics-final.json), [telemetry cleanup](reports/render-cloudflare-hosted/telemetry-final.json), [suspended Render proof](reports/render-cloudflare-hosted/render-suspended.png).

Final publication audit: zero Gitleaks findings in the staged delta; 35 known private credential/session values had no matches across 10,143 reachable blobs plus 16 staged files. New screenshots were visually reviewed with credentials masked. [Final audit receipt](reports/render-cloudflare-hosted/final-publication-audit.json). The receipt/report themselves contain only sanitized audit metadata.
