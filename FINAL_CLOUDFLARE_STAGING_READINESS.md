# Final Cloudflare staging readiness sprint

2026-10-19. Branch `poc/final-cloudflare-staging-readiness`, based on `2d65c390` plus the completed preflight `07deb215`. All implementation and synthetic execution stayed in `/private/tmp/down-distance-staging-preparation`. **Ready to deploy staging: NO. Production readiness: NOT QUALIFIED.** No remote resources, subscriptions, policies, secrets, deployments, production connections, real mail, live odds calls or ingestion were created/enabled during this sprint.

## 1. Executive summary

This sprint implements an application-level Access JWT gate, initial-deployment safety checks, an offline Access policy generator, a backward-compatible checkpoint optimization, local runtime/migration/CPU-counter probes, and a measured web layout-shift fix. It also repairs the performance harness and makes isolated web builds less disk-intensive. Engineering evidence is in `reports/final-staging/`.

The prior preflight established Workers Free and usable D1/request headroom, but **R2 and Zero Trust/Access are not enabled**. Those account changes require owner action and were not attempted again. Hosted Argon2id/SSR CPU, native Access login, whole-product storage/operations and external providers remain unqualified. Locally passing tests do not establish a $0/month product at 1,000 DAU. The capacity model contains known failures even before several unmodeled domains.

## 2. Changes implemented

- `workers/staging/access.ts` verifies signed Access JWTs using Web Crypto through existing `jose`: pinned issuer/team domain, application audience, RS256, expiration/issued-at/subject and application token type. Missing configuration, forged identity headers, bad signatures or claims fail closed. Only a bounded JWKS resolver cache is retained; no credentials/token bodies are logged.
- `workers/staging/index.ts` protects the existing web entry point. Generated web config now uses it and **runs the Worker before static assets**. HTML/API responses and all denials are private/no-store and noindex. Only successful hashed `/_next/static/` assets may use a five-minute private browser cache; they are never publicly cached. API and password Workers remain private service-binding targets.
- `scripts/prepare-staging-access.mjs` writes a hostname-wide Access application request for named reviewer identities and one explicit IdP. It rejects wildcard/empty/duplicate allow policies and performs no network operation. Output stays in ignored `.staging/`.
- `scripts/staging-deployment-guard.mjs` validates an operator evidence receipt and config graph, then emits **review-only commands**. It has no child-process or networking capability. It rejects stale receipts, non-Free Workers plan, unavailable R2/Access, insufficient stated budgets, overwritten Worker names, mismatched D1 identity, unknown/provider bindings or vars, public routes, Cron Triggers, enabled ingestion/mail and unprotected asset dispatch. A receipt is an operator assertion, not a signed or independently fetched proof of account state.
- The checkpoint codec can encrypt compressed bytes directly without an extra nested Base64 layer. Existing encrypted/plain JSON directory versions remain readable. New-format writing is **explicit opt-in**; legacy remains default. No stored objects are rewritten or deleted.
- New executable probes verify actual workerd Access/JWKS behavior, real staging HTML/API/static denial, checkpoint codec compatibility and corruption rejection, migration repeatability and local metrics. Auth probing records operation/status/time-to-headers without bodies, passwords or tokens; hosted CPU stays null.
- The browser harness optionally runs authenticated throttled performance probes asynchronously while continuing to drain Wrangler output. It now selects installed Chrome rather than an unavailable Playwright headless-shell binary. Layout-shift sources/LCP element diagnostics are retained.
- The web root reserves at least one small viewport of content before its footer, preventing the footer from first painting at the top while route Suspense is empty. Native root/navigation was inspected and has no website footer; native rendering was unchanged.
- Disposable build directories omit `.staging`, use independent copy-on-write files where supported, avoid a useless filesystem cache, and clear old generated web output before replacement. A build-only network guard permits public font CDN downloads and blocks application/provider endpoints. Normal builds retain their cache behavior unless `DD_ISOLATED_BUILD=true` is explicitly set.

## 3. Cloudflare compatibility

| Entry point / path | Evidence and scope |
|---|---|
| Web + API split | Actual local workerd browser and HTTP workflows, two synthetic owners, two team themes, persistence across restart |
| New staging wrapper | Actual generated config denies HTML, `/api/auth/config` and an existing JS asset before app dispatch; separate actual-workerd signed JWKS fixture verifies successful dispatch and claim rejection |
| Password Worker | Existing static Argon2id Wasm service; registration/native PHC verification/reset/session tests pass in actual local workerd; hashing strength unchanged |
| Application scheduler / odds processor | D1 suite exercises synthetic schedules, service processing, leases, retries, quota exhaustion and dedupe; no real Cron or provider invoked |
| Content engine POC | Existing entry intentionally local-only and returns no content HTTP API; not substituted for the application API or included in staging deployment |
| Legacy `dnd-content-scheduler` | Source uses Worker fetch/scheduled handlers with explicit URL/secret; not deployed, invoked or edited. Its existing eight-times-daily content schedule is distinct from three-times-weekly odds refresh |
| Storage adapters | D1/R2 synthetic bindings, historical search, original saved IDs, recovery and corruption paths; new compact encoding additionally executed inside workerd |

Remaining Node APIs include `node:async_hooks` request context and supported crypto compatibility under `nodejs_compat`. Node filesystem/child-process migration and benchmark tools remain local CLI tools. PostgreSQL modules remain for Node rollback; merely importing a fallback module is not equivalent to making a database connection. `authDb`/`searchDb` forbid D1-mode fallback; live Worker environment has no PostgreSQL URL. Full handler coverage is bounded by the tests, not every conceivable input/provider state.

## 4. Database migration status

All 38 migration files are unchanged. `scripts/verify-staging-migrations.mjs` creates disposable local persistence, applies migrations, repeats the command and confirms **38 rows, no pending migrations, no foreign-key violations**. Browser/auth child environments explicitly omit both PostgreSQL URL variables and block external providers. Local fixtures cover users, opaque sessions, preferences, saved content, Front Office commands/replay, trivia/Crew, sportsbook persistence, editorial/Three & Out and structured/lexical search metadata. The existing PostgreSQL migration history and rollback code remain intact. No real historical cutover was attempted; incomplete legacy saves and lossless reverse replay are still production blockers.

## 5. Storage optimization and recovery

**Root causes retained from implementation review:** history payloads remain necessary; D1 indexes/directories and metadata persist even after payload offload; indefinitely retained full checkpoint directories duplicate schema/row inventories. Weekly full + daily deltas, compression, immutable content references and chain-aware retention already exist. Retention must preserve each retained delta's base and parents. This sprint does not treat required historical odds/editorial/user records as disposable or declare orphaned immutable blobs safe to delete.

Read-only page accounting of the empty local 38-migration schema: **2,048,000 bytes**, including **696,320 table bytes**, **1,236,992 index bytes**, and **114,688 schema/internal bytes**. This is empty-schema allocation, not the distribution of populated production data. Detailed per-object page accounting: `local-storage-accounting.json`.

New opt-in binary directory format results:

| Synthetic case | Legacy → compact encrypted envelope bytes |
|---|---:|
| 5,000 Unicode rows | 55,124 → 41,300 (25.08% smaller) |
| 60,000 random-byte values represented as JSON | 139,452 → 104,540 (25.04% smaller) |
| Tiny record | 96 → 96 |
| Actual R2 directories for complete 500-user restore | **24,685 → 18,690** (24.29% smaller) |

Random bytes encoded as JSON are not a claim that every high-entropy archive compresses similarly. Actual workerd also round-tripped large Unicode and entropy fixtures and rejected altered ciphertext. Original user IDs, preferences, all original object bytes, and even an unreferenced immutable object survived full restore into fresh synthetic D1/R2. Legacy checkpoint restore was separately verified with the new reader. Existing suite validates interrupted daily-chain restore, missing/corrupt parent rejection, historical search and chain-safe retention. No data cleanup occurred.

**Rollout safety:** install/retain readers that support both formats first. Only then explicitly pass `'binary-v2'` as the last optional `checkpoint` argument after `previousId`. Old pre-sprint code cannot decode newly opted-in binary directories; retain a rollback build containing the dual reader before enabling that writer. Daily incremental writing remains legacy by default. There is no blanket 25% reduction to total R2 or a new automatic retention policy.

At 1,000 DAU, inherited annual projection is D1 **829,376,735 bytes**. R2 with all full checkpoints retained is **51,502,420,165 bytes**; weekly/daily chain-aware retention sensitivity is **8,742,672,827 bytes** at the measured low-churn ratio, **14,939,814,517 bytes** at full churn. Required payload floor alone is **7,475,423,902 bytes**, above the 7 GB operational-headroom target; high-entropy payload floor is **31,930,423,902 bytes**. The compact writer is opt-in, so no speculative annual saving is credited. New migration-domain volumes remain unmodeled. These are end-horizon projections, not GB-month invoices or a production backup certification. Snapshot assembly still has the documented 64 MB logical ceiling and requires stopped writers/unserved restore targets; no online consistency or hosted RTO guarantee is claimed.

## 6. Access protection readiness

Local defense-in-depth is ready; remote Access is not. `ACCESS_TEAM_DOMAIN` must be the reviewed tenant's exact `*.cloudflareaccess.com` domain, without protocol. `ACCESS_AUD` must be the returned 64-character application audience, **not the Access application ID**. Set both on generated web/API vars. Empty defaults deliberately deny all requests. Static assets use `run_worker_first=true`; APIs traverse the gate before their private service binding.

Prepare only a local Access request:

```sh
node scripts/prepare-staging-access.mjs REVIEWED_IDP_UUID NAMED_REVIEWER_EMAIL
```

The fixed target is `down-distance-staging-web.tdingman5.workers.dev`, including every path. No Everyone, wildcard email domain, bypass policy or email-OTP workflow is generated. Owner must separately complete Zero Trust Free onboarding, verify plan/seat requirements and IdP, create/review the hostname-specific application, obtain the audience and verify unauthorized denial before enabling the web route. Do not change account-wide protection or expose API/password routes. A valid signed local fixture is not hosted Access validation. Native needs a reviewed Access-compatible login flow and must not embed service-token secrets in released apps.

## 7. Worker CPU instrumentation

Existing application metrics count D1 statements/rows and R2 reads/writes, with route families/status and wall time. `scripts/summarize-worker-metrics.py` aggregates those structured samples without retaining identities or token-bearing URLs. New auth measurements record local time to response headers: signup about **81 ms**, successful login samples about **35–78 ms**, reset about **32 ms** in this run. These are local wall measurements with fixture overhead, **not CPU** and not p95 performance guarantees. Argon2id remains `m=19456,t=2,p=1`, 32-byte hash with randomized salts and existing PHC verification.

Likely CPU risks: password hashing/verification, SSR/hydration-related server work, full checkpoint scans/compression/encryption, bulk ingestion/scoring and serialization. A 19 MiB Argon2 memory setting is only part of the 128 MB Worker memory budget; backup assembly and temporary buffers need separate qualification. Bounded JWT key caching avoids fetching keys on every authorized request. No hosted memory sample or CPU result is invented.

After an approved private deployment, collect each Worker's platform CPU Time per execution, exceeded-resource errors, cold/warm sample counts, versions and time window; correlate sanitized request latency/counters. Tail diagnostics do not always include CPU. The Free allowance is **10 ms per invocation**, not transferable unused account CPU. Do not weaken hashing, rely on occasional runtime rollover, or activate Paid to make a test pass. Passwords remain disabled until a bounded authorized hosted canary.

## 8. Mobile performance

| Mobile-web route | LCP ms before → after | CLS before → after |
|---|---:|---:|
| `/` | 8196 → 8252 | 0.368 → 0.000 |
| `/the-beat` | 1800 → 1784 | 0.185 → 0.213 |
| `/watch` | 3044 → 3124 | 0.466 → 0.110 |
| `/three-and-out` | 2664 → 2716 | 0.509 → 0.154 |
| `/huddle` | 7028 → 7024 | 0.346 → 0.000 |
| `/front-office` | 2740 → 2680 | 0.367 → 0.011 |
| `/parlay-lab` | 4004 → 3480 | 0.355 → 0.003 |
| `/account` | 2360 → 2392 | 0.000 → 0.000 |

Homepage, Front Office, Huddle and Parlay CLS improved in the observed samples; Film Room and Three & Out remain above 0.1, and The Beat did not improve. Mobile LCP remains above 1.5 seconds. The Beat CLS variation is retained rather than discarded. Initial completed-script transfer stayed effectively unchanged on most sampled routes (Home 399,555 → 399,545 bytes); Account varied 215,629 → 238,139 bytes. No broad bundle-size or LCP improvement is claimed.

KC and SEA full-page mobile-web screenshots were visually inspected after the fix; route/overflow checks also passed at desktop widths. Android/iOS were not built or visually checked.

Method: actual local workerd, synthetic authenticated KC account, Chrome 390×844 / 1440×1000, network 1.6 Mbps/150 ms/4× CPU on mobile-web and 10 Mbps/40 ms/1× on desktop. Cold browser cache per navigation; 1.5-second post-load observation; one sample/state, not statistically controlled p95. Cross-origin browser requests are blocked. Null LCP is unmeasured. INP remains unmeasured because no representative trusted interaction suite was added. No device speed claim is made from viewport emulation.

Before diagnostics identify the footer at y=0 during empty Suspense as the largest common CLS event (~0.355 on mobile). The min-height wrapper addresses that measurable web-only cause. LCP remains affected by the hero image, heavy initial script/hydration and content requests. No new client dependency, score change or speculative lazy-loading experiment was introduced. Root native shell and footer absence were inspected; Android/iOS were not built or device-tested. Browser smoke screenshots cover KC/SEA at desktop/mobile-web widths; native rendering/business behavior was unchanged.

## 9. Parlay Lab validation

Full D1 suite retains precomputed model/context/board-bound Lab Scores, stored odds attribution/stale disclosure, proposals and sportsbook transfer persistence, alt-line/selection identity and quote eligibility. Dedupe, retry, partial coverage, quota exhaustion and exactly three weekly ingestion slots are tested using fixtures. The odds schedule remains **Mon/Wed/Sat 15:00 UTC**, `0 15 * * 1,3,6`, and is not deployed/enabled. Browser Parlay routes and owner-scoped saved selections run against D1. FanDuel/DraftKings transfer records and generated handoff contracts are local tests, not verified live sportsbook acceptance or real transactions. No live odds API or sportsbook action occurred.

## 10. AI and email readiness

Existing D1 tests exercise structured search classification, evidence/source attribution, lexical fallback, source-versioned shared inference, queued summaries/Three & Out, preferences, unsubscribe/opt-out, encrypted reset messages, dedupe, quota reservations, explicit provider rate rejection, retries and ambiguous-send handling. Provider responses are mocks; no actual delivery/inference was performed. New staging configs intentionally have no AI binding or provider credentials, so no paid fallback can run accidentally.

Live qualification requires separate approval: choose a Free-eligible Workers AI model and verified account neuron budget; add only a staging AI binding; run a few synthetic bounded prompts and record actual neurons, errors and source fidelity. For email, verify staging sender/domain and account allowance, configure staging-only `RESEND_API_KEY`, `APP_MAIL_FROM` and encryption key, and use a separately approved provider test/sink mode. Real delivery is still prohibited; do not turn on a mail cron to test connectivity. No current plan assumes these external accounts are enrolled or have headroom.

[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) provides 10,000 neurons/day on Free with model restrictions; the model's inherited 7,000/day reserve is an assumption, not measured inference demand or available account quota. [Resend pricing](https://resend.com/pricing) advertises 100/day and 3,000/month on Free; account eligibility/sender enrollment were not inspected. With assumed daily subscribers at 10% DAU, 1,000 DAU uses 100/day before auth mail, and 1,500/2,000 DAU exceed that daily allowance. Sports API account credits are unverified; 780 reserved objects/month is not necessarily 780 billable API credits.

## 11. Deployment automation and exact prerequisites

Existing account proof is in the preflight report. Recheck it immediately before future execution: Workers Free, account ID/subdomain, daily operations, R2 subscription/usage, Zero Trust plan/identity policy, billing/overage implications and named-resource ownership. The current account cannot produce an honest passing deployment receipt. `receipt.example.json` deliberately contains disabled services and invalid placeholders; the guard rejects it.

After **separate owner authorization** for metered R2 setup, Access onboarding, fresh remote resources and deployment, follow the resource-creation commands from `CLOUDFLARE_STAGING_DEPLOYMENT_PLAN.md`. Confirm all names are new; preserve production and existing scheduler. Then generate configs:

```sh
export CLOUDFLARE_ACCOUNT_ID=6e8c301360ab628706dcf3acf55f0dbb
node scripts/prepare-cloudflare-staging.mjs NEW_STAGING_DATABASE_UUID tdingman5
```

Pin `account_id` to that reviewed account in all three JSON files; set `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` in web/API; leave every route, preview, Cron and ingestion flag disabled. Compare the fresh UUID to the newly created staging database name/account and both bucket names. Populate a private copy of `receipt.example.json` with fresh (<one hour) actual account evidence, not invented booleans, and no secret values. Then:

```sh
node scripts/staging-deployment-guard.mjs .staging/account-receipt.json
```

On success `.staging/reviewed-commands.sh` contains exact initial migration/deployment/interactive-secret commands. **It is not executed by the guard.** It applies 38 ordered migrations to fresh staging, deploys password → API → web privately, and prompts for new JWT/mail keys. The generator does not mint or upload secrets. Remote verification commands, dry-run builds, rollback and staged routing gates remain in the deployment plan; the new JWT/asset gate and account receipt are additional requirements. Only an approved operator may enable web `workers_dev`; API/password/preview remain false. Verify Access interception and application-session isolation before testing authenticated mutations.

Health gates: unauthorized HTML/API/static requests denied; authorized web/config reaches the correct app; anonymous saved-content API rejects; private/cache isolation preserved; two synthetic owners stay isolated; original saved IDs/Front Office commands survive restart. Run bounded hosted CPU and matched D1/R2 recovery checks before calling a canary successful. Never migrate real users for a smoke test.

Rollback: stop writers and disable the staging web route if necessary, retain compatible Worker version IDs and secrets, and use `wrangler rollback PREVIOUS_VERSION_ID --config .staging/ROLE.json` for code only. Preserve the dual checkpoint reader if any binary-format checkpoint was written. First deployment has no prior version. Restore matched D1/R2 checkpoints to a fresh private target, verifying object digests, IDs, foreign keys, history and ownership before a reviewed rebind. Do not down-migrate/delete populated data or toggle to stale PostgreSQL. Code rollback is not data rollback.

## 12. Complete test results

| Validation | Final result |
|---|---|
| Full application suite | **1,072 passed; 0 failed; 2 skipped** |
| Full Worker/D1 suite | **120 passed; 0 failed** |
| Browser route checks | **48 passed; 0 failed**, two teams and desktop/mobile-web |
| Extra HTTP workflow contracts | **12 passed**, including restart/private-owner workflows |
| Real Trade Machine HTTP regression | **1 passed**, separately invoked within browser harness |
| Actual local workerd authentication | **PASS**, 10 scenarios, PHC compatible; 16 latency samples recorded |
| Staging config/policy/guard/build-network tests | **7 passed**, included in application suite |
| Access signed JWKS workerd fixture | **21 checks passed** |
| Actual generated staging config denial | **3 paths passed**: HTML/API/real static asset |
| New backup codec workerd probe | **3 payload cases passed**, exact round-trip and corrupted ciphertext rejected |
| Synthetic full checkpoint restore | **500 users preserved**, both legacy and opt-in formats; included in Worker suite |
| Ordered migration / second apply | **38 applied, no pending migrations, zero FK violations** |
| TypeScript | **PASS** |
| Next/OpenNext build + local Worker dry run | **PASS** after disk/copy/preload fixes |
| Final staging web bundle dry run | **PASS**, 12,181.19 KiB uncompressed / 2,339.36 KiB gzip |
| Hosted deployment/CPU/Access/provider/device tests | **NOT RUN / NOT QUALIFIED** |

The two application skips are the PostgreSQL-only sportsbook fixture and Trade Machine test requiring a real HTTP server; the latter passed separately against local Workers. Categories overlap and must not be summed as unique product workflows. The local route metrics retain six 503 responses from `/api/three-and-out` when a fixture has no published briefing; before/after both retain that unavailable-content state. These are not silently converted to successes or evidence of populated production content. Browser navigation itself returned 200 for all 48 checked routes.

Reproduction commands, all local:

```sh
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
node scripts/probe-staging-auth.mjs
node scripts/probe-staging-access.mjs
node scripts/probe-staging-denial.mjs
node scripts/probe-backup-codec-workerd.mjs
node scripts/verify-staging-migrations.mjs
D1_BROWSER_REPORT_DIR=reports/final-staging/browser D1_PERFORMANCE=true node scripts/validate-d1-browser.mjs
node --import tsx scripts/benchmark-final-codec.ts
python3 scripts/final-staging-capacity.py
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.completion.json
node scripts/build-split-worker.mjs
```

The new workerd probes use only local synthetic keys and fixtures. The first browser attempt exposed an unavailable Playwright binary; the next exposed synchronous subprocess log starvation. Both were corrected. Isolated rebuild attempts exposed disk exhaustion, an over-strict font network guard, and Next's repeated-preload parsing; final outcomes below supersede those retained diagnostic logs. Existing style warnings are not silently counted as test failures. No test was deleted or skipped to improve results.

## 13. Final capacity review

All projections below retain required history; unmodeled domains remain unknown. They inherit the previous workload model and measured low-churn sensitivity. They are **not traffic measurements** or hosted qualification. `capacity.json` includes raw data and assumptions.

| DAU | Worker req/day lower bound | D1 read/write rows/day lower bounds | D1 year MB | R2 year GB, retained low-churn sensitivity | R2 A/B per 30 days lower bounds |
|---:|---:|---:|---:|---:|---:|
| 100 | 13,798 | 2,017,802 / 71,849 | 452.4 | 7.53 | 277,121 / 10,837,175 |
| 500 | 36,851 | 2,285,290 / 82,269 | 620.0 | 8.07 | 295,383 / 14,493,365 |
| 1,000 | 65,668 | 2,619,650 / 95,294 | 829.4 | 8.74 | 318,210 / 19,063,625 |
| 1,500 | 94,484 | 2,954,010 / 108,319 | 1,038.8 | 9.42 | 341,038 / 23,633,885 |
| 2,000 | 123,301 | 3,288,370 / 121,344 | 1,248.2 | 10.09 | 363,865 / 28,204,145 |

[Current Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and the preflight verify Free 100k requests/day, 10 ms CPU/invocation; script cap is now 64 MiB **uncompressed**. [D1](https://developers.cloudflare.com/d1/platform/pricing/) account-wide 5M reads/100k writes daily and 5 GB total do not remove its 500 MB/database cap. Extra databases do not add writes. [R2 Standard](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month, 1M A and 10M B monthly; overages are billable. [Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) protects hostname paths only after account/policy setup.

The staging-only JWT gate intentionally runs before assets and keeps HTML/API no-store and permits short private caching for successful hashed assets. Cold loads can add Worker invocations for assets that would otherwise bypass application execution. The inherited request column does **not** include this new private-staging overhead. The measured page samples recorded 60–110 subresource requests per navigation (including APIs, not just assets). An intentionally conservative sensitivity counting 110 extra calls for one cold navigation per DAU yields **24,798 / 91,851 / 175,668 / 259,484 / 343,301** requests/day at the five DAU levels; it can double-count API work and is not a billing forecast. Do not reuse this private staging routing policy as a free public-production asset plan. Actual hosted request accounting remains capacity work; warm private caching is implemented but its hosted hit rate is unverified. No claim of unchanged request cost is made.

**First immediate constraint is account enrollment (R2/Access).** In the inherited annual whole-product envelope, even 100 DAU exceeds R2 Class B allowance; 500 DAU exceeds single-D1 size, 1,500 DAU exceeds daily writes, and 2,000 exceeds daily requests. At 1,000 DAU, only 4,706 daily writes remain before unmodeled/auth/maintenance overhead. CPU may limit any level sooner, and actual AI/mail/sports allowances remain unverified. Backup scanning operations are included only to the extent of the inherited lower bound; streaming/durable snapshot scheduling and realistic churn remain open.

Projected monthly cost: **not qualified as $0**. At 1,000 DAU, inherited R2 Class B excess alone would be about **$3.26/month** if metered R2 were enabled, before any other overages; D1 may stop serving at Free limits rather than automatically permitting the projected data. This is not a whole-product bill estimate. Maximum sustainable DAU at $0: **unverified; none of the requested levels qualifies**. No paid infrastructure was activated to mask this result.

## 14. Remaining blockers

1. Owner-approved R2 metered subscription and Zero Trust Free onboarding/identity policy; the preflight found both disabled and no payment method. This sprint did not access production/account state again.
2. Hosted Argon2id/SSR CPU, real Access protection and exact account usage. Local success cannot establish the 10 ms hosted limit.
3. Sustainable historical D1/R2 capacity and operation budgets; several required-history/model lower bounds fail. No required data was discarded.
4. Hosted AI/email/sportsbook/provider behavior and native Access login; all live providers remain off.
5. Historical user-data cutover, incomplete legacy saves, live writer-freeze/recovery orchestration and reverse replay remain separate production work.
6. Mobile LCP/INP qualification and any residual CLS; device performance is unverified. Staging smoke improvements are not a Core Web Vitals guarantee.

## 15. Recommended next action

Review this commit and the preflight account evidence. The owner must decide whether to authorize R2's metered subscription and complete Zero Trust Free onboarding without purchasing a paid plan, or provide an already-enabled authorized staging account. Then obtain fresh account/Access/budget evidence, create only new synthetic staging resources under separate approval, populate the guarded receipt/config, and request a bounded **private CPU/health canary**, keeping all ingestion/mail/provider schedules disabled. Do not approve production cutover or a $0/1,000-DAU claim from this report.

**Stop for review. No deployment or remote resource creation performed.**
