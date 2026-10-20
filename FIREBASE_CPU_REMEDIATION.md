# Firebase Worker CPU remediation

**Local remediation prepared; hosted CPU compliance remains UNVERIFIED. No deployment or remote mutation occurred. Staging exposure remains disabled in the checked-in configuration; this mission did not enable it.**

| Required item | Result |
| --- | --- |
| Root cause of 47 ms | Confirmed failing invocation: **down-distance-rc3-staging-api**, **POST /api/auth/firebase/session**, first Firebase registration-related identity exchange. The historical trace reports 47 ms total CPU, not per-function CPU; its component-level cause remains **UNATTRIBUTED**, rather than assumed to be signature verification |
| CPU attribution | Numeric bounded request-local spans added for JWT/key fetch/key resolution/Firebase claims, provider lookup, D1 provisioning/revocation, session creation/lookup/signing/encryption, middleware, SSR auth transport and response serialization. Separate local Node process CPU samples captured; they are not Worker/hosted CPU |
| Changes implemented | Remove discarded web access-JWT signing; atomically create the already-expiry-capped session and Firebase association while revoking only an owned prior session; remove redundant user rereads; snapshot/parse configuration once per request |
| Security validation | PASS locally: unchanged jose RS256/standard claim checks and additional Firebase claims; online provider/validSince and D1 revocation checks retained on every authorization; cross-user denial, erasure/ledger replay, atomic rollback and private staging gate regressions pass |
| Local tests | Auth/SSR/unit checks **23/23 PASS**; Firebase lifecycle/local CPU comparison/multi-D1 erasure/staging checks **5/5 PASS**; compiled workerd/OpenNext SSR PASS; production build (including API compilation) PASS; five Worker dry runs PASS; typecheck/changed-file formatting PASS. Retained offline legacy runtime regression also rerun |
| Expected hosted improvement | Less work is established: synthetic first exchange **18→14 SQL statements, 9→7 D1 calls**; existing-user refresh **22→14 statements, 12→7 calls**; web signs zero access JWTs, native signs one. A numerical hosted CPU improvement or <=10 ms result is **not measured** |
| Remaining blockers | Actual cold/warm/native/SSR Worker CPU retest and component-level hosted attribution; instrumentation overhead; broader hosted auth/product/recovery/native-device gates. Local results cannot close the 47 ms hosted failure |
| Exact next owner action | Review this local candidate and the [staging retest plan](reports/firebase-cpu/hosted-retest-plan.md), then separately authorize uploads to the existing private API/Web Workers and a bounded actual-CPU retest. Keep all public staging exposure disabled until that review; no database migration or new resources are required |
| Branch | release/down-distance-firebase-auth |
| Commit | Baseline **75e6910d**; implementation and evidence **ec95446dde78**. The following documentation commit contains this report; `git rev-parse HEAD` identifies the complete deliverable |

## Historical measurement and confirmed redundant work

The [original Cloudflare trace](reports/firebase-hosted/measured-authentication.json) records API HTTP 200/outcome ok, **47 ms CPU**, 708 ms event wall time, 9 D1 calls, 18 statements, 12 read rows and 24 written rows. No password Worker event was observed. It does not include signature/public-key/provisioning/signing CPU counters, a CPU profile, a Web CPU event for this operation, or multiple cold/warm samples. The 47 ms therefore cannot honestly be divided into cryptography, D1, runtime initialization or JSON costs retrospectively.

Source inspection established four concrete inefficiencies independently of CPU assumptions:

1. The Firebase web exchange called `issueSession`, which always minted a native HS256 access JWT. The web response discarded that JWT. Web exchanges now issue only their existing opaque, HttpOnly cookie; native requests explicitly retain one access JWT with unchanged issuer/audience/lifetime and D1 session binding.
2. A session was created with a 30-day expiry, then rewritten to the Firebase token expiry in another fenced D1 batch. The new session and encrypted Firebase association are now inserted together with the correct capped expiry. An owned prior-session revocation is in the same atomic batch, replacing a lookup and separate revocation write. A foreign token cannot revoke another user's session.
3. `resolveSocialUser` reread a user already returned by `linkSocialIdentity`; the exchange then reread that user again. Those duplicate reads are removed while status, UID mapping, collision handling and ownership checks remain.
4. Every configuration property access previously spread process.env/request bindings and reparsed the full auth schema. A unique scope is now created on every `withApplicationBindings` entry, even when the caller reuses the binding-input object. Environment snapshots and parsed config live in WeakMaps keyed by that request scope. They contain configuration only, not identity/authorization decisions, and cannot cross request boundaries. Unscoped Node configuration remains dynamic.

No redundant signature verification was found inside the first exchange: it performed one Firebase verification. Protected subsequent sessions still verify the stored provider ID token and current online account state. No token/authorization cache was added. The existing jose JWKS resolver already caches parsed public CryptoKeys; rewriting it was unnecessary. Its 10-minute cache and 30-second refresh cooldown are now explicit, with separate cold-key fetch timing. Neither stale successful identity nor revocation state is cached.

## Attribution boundaries and local measurements

The staging-only `APP_AUTH_TIMINGS=true` flag enables bounded, request-local fixed-name/numeric timing records. No raw token, user ID, email, cookie, secret, exception message or provider response is logged. The context is shared safely across local module adapters and each request has its own bounded array (maximum 96 records). Normal disabled instrumentation adds no timing records. SSR timing retains the private API service-binding boundary and does not cache authentication.

| Span | What it measures |
| --- | --- |
| jwt.signature | jose verification including standard JWT claim validation and nested key resolution; **inclusive**, not pure RSA CPU |
| jwt.public_key / jwt.key_fetch | Existing cached key resolution/import, and the fixed-origin JWKS fetch when needed. Warm resolution does not fetch again |
| jwt.claims | Additional Firebase-specific UID/auth_time/tenant checks; standard jose claims remain inside verification |
| provider.lookup / d1.revocation | Online account/validSince validation plus independent current D1 tombstones; no cached successful authorization |
| d1.provision | Stable D1 UUID mapping/provisioning and its retained ownership/email-collision behavior |
| session.create / session.lookup | Atomic capped session/provider association and prior-owned revocation; initial opaque session lookup respectively |
| session.sign / session.encrypt | Native access JWT signing only; existing AES-GCM encryption of the short-lived provider token |
| middleware / request.parse / json.serialization | API middleware, request parsing and response JSON construction, separately |
| ssr.authentication | Elapsed private service-binding authentication transport. API CPU must be collected as a separate Worker event |

Worker `performance.now` spans are **elapsed time**, may be coarse/advance at I/O boundaries, and include waits. Nested spans overlap and must not be summed as CPU. In particular, standard JWT claims and RSA verification are not separately timed inside jose; changing validation libraries simply to split that small boundary would introduce unnecessary security risk. Hosted per-stage CPU remains unmeasured.

A local sequential comparison used the exact archived baseline source at 75e6910d and the optimized source, disposable ten-D1 stores, synthetic RSA tokens and intercepted provider responses. The storage epoch was initialized before either variant to avoid charging only the first variant for fixture initialization. The local sampler uses **Node process.cpuUsage**; it includes Node orchestration/crypto threads but **excludes the D1 workerd subprocess**, module initialization before the test and actual Cloudflare CPU. One sample per operation is diagnostic, not a performance distribution or a pass/fail budget test.

| Local operation | Baseline Node CPU ms | Optimized Node CPU ms | Baseline→optimized D1 calls | SQL statements |
| --- | ---: | ---: | ---: | ---: |
| First web exchange | 47.814 | 24.167 | 9→7 | 18→14 |
| Existing-user web refresh | 37.782 | 28.521 | 12→7 | 22→14 |
| Native exchange | 35.507 | 27.228 | 9→7 | 18→14 |

The optimized first-web sample contained 0.765 ms inclusive Node CPU in JWT verification (0.454 ms nested key resolution), 0.049 ms additional Firebase claims, 0.189 ms intercepted account lookup, 3.458 ms D1 tombstone orchestration, 15.355 ms provisioning orchestration, 0.134 ms encryption and 3.291 ms session creation orchestration. These local numbers argue against *assuming* RSA is the bottleneck; they do not identify which function consumed the historical hosted 47 ms. Local fixture RPC cost is particularly unlike production D1 binding execution. No forecast such as “47 ms becomes X ms” is made.

[Full local CPU/SQL comparison](reports/firebase-cpu/local-comparison.json). The optimized three requests fetched public keys once and performed a fresh provider lookup each time; key caching did not become authorization caching.

Local workerd V8-inspector profiling was also attempted: the tiny inspector control worked, but the full API bundle failed to start under that profiling harness with an internal runtime error. Normal compiled API/SSR workerd tests passed without it. [Diagnostic](reports/firebase-cpu/baseline-profile.log). No Worker CPU profile is claimed from that failed attempt; the supported local Node sampler is clearly distinguished above.

## Validation and recovery safety

- [Auth/SSR tests](reports/firebase-cpu/auth-tests.log): invalid/expired/forged/wrong project/issuer/UID/tenant tokens, provider redirect/error/metadata denial, private SSR transport and request-local configuration/timing isolation; 23 passed.
- [Worker tests](reports/firebase-cpu/worker-tests.log): Firebase web/native identity, user isolation, expiration, revocation, disabled/reset/deleted state, collision preservation, native access tokens, no discarded web JWT, account erasure and independent ledger replay/restart; plus multi-D1 erasure and staging access. Five passed, with no skipped case in this explicitly configured run.
- Atomicity tests deliberately fail the provider-association insert and verify no new session survives and the previous owned session is not revoked. This strengthens the baseline's separate creation/update sequence rather than accepting a transient unbound session.
- [Compiled local workerd/OpenNext](reports/firebase-cpu/firebase-ssr-workerd.json), [numeric stage log](reports/firebase-cpu/ssr-workerd.log): ten synthetic databases, actual RSA exchange, four signed-in pages, expired/invalid/revoked redirects, private gate and two-user API isolation. Firebase replies are intercepted; this is not hosted CPU.
- [Production build including API compilation](reports/firebase-cpu/production-build.log), [five private dry runs and hashes](reports/firebase-cpu/update-manifest.json), [typecheck](reports/firebase-cpu/typecheck.log), [format](reports/firebase-cpu/format-check.log). Existing unrelated lint/hook/Edge warnings remain. No native UI was changed and no device validation is claimed.
- [Explicit offline legacy workerd regression](reports/firebase-cpu/legacy-runtime.log) checks retained Argon2id/password/session compatibility under the existing test-only rollback flags. Parameters are unchanged and legacy staging access remains disabled.

The first strengthened timing test exposed separate ESM/CJS timing-context instances in the local harness; a shared-symbol AsyncLocalStorage context corrected instrumentation without caching users or weakening assertions. All final security checks pass. No schema change is required. Existing account-erasure fences, tombstones and independent current erasure ledgers remain intact. No hosted recovery or occupied-store restore occurred.

## Release decision and next action

This is a smaller local candidate with validated security and lower statement counts, **not a resolved hosted CPU qualification**. The historical 47 ms remains the latest actual Cloudflare CPU observation. Actual module/cold-key costs, native signing, authenticated SSR and profiling overhead still need a bounded hosted retest. Product/recovery/native-device gates remain open.

The [review-only retest plan](reports/firebase-cpu/hosted-retest-plan.md) gives exact private API/Web upload commands and ordered cold/warm registration, identity exchange, SSR, refresh, logout, revocation and CPU checks. This mission executed none of those uploads or exposure changes. Keep staging disabled; obtain separate owner approval for that retest and stop immediately on any >10 ms sample/security failure. No paid service, provider change, production modification, resource creation, hashing change or CPU-limit increase is proposed.
