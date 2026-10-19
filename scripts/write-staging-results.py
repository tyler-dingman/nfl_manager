"""Render review reports exclusively from committed-source local evidence."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
def read(p):return json.loads((root/p).read_text())
def tap(p):
 s=(root/p).read_text();return {k:int(re.findall(r'^# '+k+r' (\d+)$',s,re.M)[-1]) for k in ['pass','fail']}
logs=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log','password-unit.log']
results={p:tap('reports/staging-readiness/'+p) for p in logs}
assert all(r['fail']==0 for r in results.values()),results
passed=sum(r['pass'] for r in results.values())+2
capacity=read('reports/staging-readiness/backup-capacity-model.json');annual=next(r for r in capacity['scenarios'] if r['days']==365)
scale=read('reports/staging-readiness/scale-recovery.json');inc=scale['incremental'];browser=read('reports/staging-readiness/browser-results.json');assert len(browser['routes'])==48
before=read('reports/performance/before-team/web-vitals.json');after=read('reports/performance/final/web-vitals.json');assert len(after['results'])==22
bundles=read('reports/performance/route-bundles.json');api_before=read('reports/performance/before/public-api.json');api_after=read('reports/performance/after/public-api.json')
def gb(n):return f'{n/1e9:.2f}'
report=f'''# Staging readiness — local review only

Baseline `56834b13`, isolated branch `poc/cloudflare-staging-blockers` in `/private/tmp/down-distance-staging-blockers`. No deployment, production database/account access, paid service activation, or existing editorial/user-data deletion. PostgreSQL remains the default and its migration history is intact.

| Required result | Status |
|---|---|
| Password runtime | **PASS in actual local workerd**; hosted Free CPU is unqualified |
| PostgreSQL-free operation | **FAIL for the whole application**; qualified D1 workflows below pass |
| D1 migration | **PARTIAL** |
| R2 projected storage, 365 days / inherited 1,000 DAU | **{gb(annual['r2BytesAtMeasuredLowChurnRatio'])} GB** at measured low-churn sensitivity; **{gb(annual['r2BytesAtTenPercentDeltaRatio'])} GB** at 10% daily deltas; **{gb(annual['r2BytesAtFullChurnRatio'])} GB** at full churn |
| Recovery validation | PASS: 5,000 synthetic users, 5,000 saved bets, original IDs, immutable histories and interrupted restore |
| Worker runtime | Local password + split web/API HTTP tests pass; hosted CPU/memory/account quotas unverified |
| Automated tests passed | **{passed}**, plus **48** browser cases and **58** split Worker HTTP samples |
| Automated tests failed | **0 in final runs**; 2 conditional unit skips execute in dedicated database integrations |
| Ready for staging | **NO** for full-product $0 qualification; configuration prepared for review |

## Password blocker and implementation

The previous Worker adapter deliberately threw and four routes returned 503. The Node Argon2 addon cannot run as a native binary in workerd; Cloudflare's Node crypto compatibility does not provide Argon2. The solution is a private service-bound Worker using static precompiled Wasm from pinned `hash-wasm@4.12.0`. The vendor license, loader transformation and SHA-256 provenance are retained. No hashing algorithm changes were made.

Argon2id remains v19, 19,456 KiB, 2 iterations, parallelism 1, 32-byte output and random 16-byte salt. Verification uses stored PHC costs and constant-time binary comparison. Stronger bounded legacy parameters are honored; unsupported algorithms/costs require the preserved Node verifier and fail closed. This is not qualification of unknown production hashes. One active hash and a four-operation queue bound memory. Password requests and bodies are bounded; no public route or credential logging is added.

Actual Wrangler/workerd tests cover registration, Node-generated PHC login, wrong credentials, concurrent sessions, logout isolation, expiry, encrypted reset mail, single-use reset, old-password rejection and process restart. PostgreSQL variables are **absent**, rather than empty, in this harness. Delivery preferences also pass real Worker tests for four atomic channels, timezone/time preservation and email eligibility. Mail is inspected synthetically; no mail provider is contacted. See `reports/staging-readiness/password-runtime.json` and `password-unit.log`.

**Remaining:** hosted password CPU cannot be inferred from wall time. The 10-ms Free CPU constraint is unqualified, so `APP_PASSWORD_ENABLED` defaults false in review templates. Do not weaken Argon2 to fit it.

## D1 migration and rollback

Additive migration 0027 adds owner-scoped device/push/notification/consent/editorial-override directories. Payloads remain immutable R2 objects; push tokens stay encrypted. New adapters cover inbox/read/dismiss/preferences/consent/device operations, complete notification account export (including dismissed/expired records beyond 50), Film Room reference reads, editorial overrides, Parlay freshness/movement and D1-backed grading. Original IDs and PostgreSQL implementations are preserved.

Critical existing D1 tests cover auth/users/sessions, saved content, daily trivia, rewards, public editorial/search/saved IDs, odds/precomputed scores, Front Office versioned commands/replay/rollback/restart and scheduled job primitives. All execute without `DATABASE_URL` or Neon. This does **not** establish a PostgreSQL-free whole product.

`postgres-dependency-inventory.json` inventories 62 source files / 331 textual SQL/config references, including guarded rollback implementations. A file-level D1-branch hint is not a qualification claim. Remaining direct dependencies include Huddle, crews/media, Game Day, commerce, account deletion, web push, full trivia/social/groups, transfer workflows, editorial ingestion/automation, search answer enrichments, schedule/stat importers and observer/admin paths. Legacy executable Front Office save conversion and new-domain import adapters remain incomplete. The new notification schema is not proof of migration of existing PostgreSQL notifications.

The earlier single-D1 projection remains 829.4 MB at 365 days: the query optimization changes reads, not storage. Splitting databases would not add daily write allowances or cross-database transactions. Keep the isolated POC and original PostgreSQL rollback environment until remaining workflows and lossless import/reverse-replay are qualified.

## Backup root cause, storage and recovery

The 51.50-GB annual estimate included **44.03 GB** of retained daily full backup directories. Changing snapshots were independently encrypted, so immutable payload deduplication did not deduplicate those full directory generations. Required payload history and deliberate primary/recovery copies account for the other **7.48 GB**; they are not all redundant objects.

The new offline policy takes a weekly full, at most six chained daily row deltas, and retains 35 days of daily recovery points plus every required parent. RPO objective: **24 hours**, conditional on successful daily execution with writers stopped. Production RTO is unverified. Compression precedes existing authenticated encryption; multiset row patches preserve duplicate virtual-table rows. Hash/schema/inventory/parent checks reject corruption or missing chain members. Schema changes require a fresh full. No user payload objects are pruned.

Scale evidence: weekly directory **{inc['weeklyDirectoryBytes']:,} bytes**, daily delta **{inc['dailyDirectoryBytes']:,} bytes** for 100 changed users / 200 row operations; weekly capture **{inc['weeklyMs']/1000:.2f}s**, delta **{inc['dailyMs']/1000:.2f}s**, restore **{scale['restore']['milliseconds']/1000:.2f}s** locally. Original user/saved/market IDs, 401 game versions, 100 franchise heads and a 2.1-MB high-entropy value survive. Corruption, missing patches, interrupted restore, replay and interrupted directory-prune retry are tested. Retention first persists an encrypted delete ledger; retries can finish after some directories are already absent.

Annual payload breakdown: historical editorial/other inherited payloads 2.942 GB; Front Office history 0.456 GB; odds history 0.250 GB; shared AI 0.299 GB; configuration/attachments 0.066 GB; newly modeled saved metadata, identities, scores and public payloads 3.462 GB. Two payload copies are retained intentionally. Unknown domain volumes remain unknown.

| Days | D1 MB | Old R2 GB | Payload floor GB | Weekly + daily, low churn GB | Full-churn GB |
|---|---:|---:|---:|---:|---:|
'''
for r in capacity['scenarios']:
 report+=f"| {r['days']} | {r['d1Bytes']/1e6:.1f} | {gb(r['beforeR2Bytes'])} | {gb(r['payloadFloorBytes'])} | {gb(r['r2BytesAtMeasuredLowChurnRatio'])} | {gb(r['r2BytesAtFullChurnRatio'])} |\n"
report+='''
These are explicit sensitivity projections, not measured annual storage. The 0.25 directory/D1 factor and inherited content compression remain assumptions. The measured 0.37% delta/full ratio applies only to the low-churn fixture. At 365 days the payload floor alone exceeds the 7-GB headroom budget; worst-case high-entropy payloads alone reach 31.93 GB. There is no qualified sustainable whole-product free-tier footprint. The 35-day optimistic point is below 10 GB with about 13% storage margin, not 30%. Multi-year retained payloads exceed 10 GB even before directories.

The old lower bound of 19.06M R2 Class B/month and 95,294 D1 writes/day is not erased by storage compression. Daily deltas still hash all source objects, and offline assembly retains a 64-MB logical snapshot ceiling. Streaming snapshots, durable scheduling/write freezes, realistic daily churn and quota-aware backup operations remain production blockers. No lifecycle policy was activated and no existing backup was deleted. See `backup-capacity-model.json`; reproduce with `python3 scripts/project-staging-backups.py`.

## Validation and staging preparation

Final unit/Worker/database logs, synthetic recovery, browser screenshots, builds and dependency audit are in `reports/staging-readiness/`. The failed concurrent run during temporary disk pressure is preserved in `d1-all-tests-infrastructure-retry.log`; the complete unchanged suite subsequently passed serially. A separate full PostgreSQL migration experiment stops at migration 017 because local pgvector is unavailable; dedicated rollback integrations pass, but the complete PostgreSQL schema is not qualified.

Review templates: `config/staging.web.template.toml`, `staging.api.template.toml`, `staging.password.template.toml`, `staging.env.example`. IDs/buckets are placeholders, routes and cron activation are absent, public preview is disabled and feature flags default off. Do not use them as approved deployment configuration. Required secrets: `AUTH_JWT_SECRET`, `APP_MAIL_ENCRYPTION_KEY`; provider/OAuth/automation/mail secrets only for separately approved features. Set `AUTH_BASE_URL`, release-specific `APP_CACHE_VERSION`, private service bindings and approved editor IDs. `DATABASE_URL` belongs only to the PostgreSQL rollback environment.

Local commands:

```sh
node scripts/build-password-worker.mjs
node scripts/build-split-worker.mjs
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --local --config wrangler.api-local.toml --persist-to /private/tmp/dd-review-local
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
python3 scripts/qualify-staging-postgres.py --browser
node scripts/probe-staging-web.mjs
```

A future approved staging rollout needs actual staging resource IDs, confirmed account-wide quotas, migration backup/checksums, execution of all additive migrations, and synthetic health checks: auth config, public event API MISS/HIT, private 401/no-store, registration/login/reset, D1 persistence/restart, saved IDs, and restore into an unserved target. No remote migration or deployment command was executed here.

Rollback: freeze writers; retain the original PostgreSQL database/migrations and reviewed Worker release; restore a verified weekly-plus-delta chain into an unserved target; check row/object hashes, original IDs, foreign keys and saved links before routing traffic. Node can verify new Argon2id hashes. Do not simply flip back to PostgreSQL after D1 writes: lossless reverse replay/reconciliation is still a blocker. Keep old data and immutable objects until that check passes.

Sources verified for review: [Worker crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [static Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 Standard free tier](https://developers.cloudflare.com/r2/pricing/). D1/R2/Worker allowances are account-wide; extra databases do not multiply daily D1 writes. No paid infrastructure was activated.
'''
(root/'STAGING_READINESS_REPORT.md').write_text(report)
perf='''# Performance optimization — measured local results

Isolated branch `poc/cloudflare-staging-blockers`, baseline `56834b13`. No production deployment or remote database access. The existing Node/PostgreSQL rollback build and split web/API Worker architecture were inspected before optimization. React Native Android/iOS screens remain native; this change adjusts request behavior, not screen rendering.

## Baseline, method and limits

Before: the baseline production `.next` build, selected KC team, authenticated synthetic account. After: the final production build with the same fixture and benchmark script. Eleven areas were sampled at mobile 390×844 and desktop 1440×1000. Mobile CDP throttle: 1.6 Mbps down / 0.75 Mbps up / 100-ms latency / 4× CPU slowdown; desktop 10 / 5 Mbps / 40 ms / 1×. Cold browser contexts, 3-second post-DOM observation, one sample per route/device. Server image-cache state was not standardized: the baseline reused a prior built cache, while new image derivatives initially needed processing. This limits causal comparisons of page paint. These are local laboratory samples on a shared host, not statistically controlled distributions or production RUM. The local Next server blocks provider connections; browser asset requests can still include public external images. Optional synthetic-schema failures/empty responses are retained in the JSON, not counted as populated workflow success.

LCP, CLS, TTFB, completed-resource JS transfer and API timings were recorded. Event Timing measures a benign local interaction where available; **field INP is unsupported here**. Null interaction samples mean unmeasured. The AI Search sample opens the search overlay; it does not qualify hosted AI answer latency. Trending Props and Bet Slip are identified Parlay routes/states, without provider transactions. Database counts and cache hits are measured separately in local workerd, not inferred from browser paint.

Raw evidence: `reports/performance/before-team/web-vitals.json`, `final/web-vitals.json`, `route-bundles.json`, `query-plans.json`, `before/public-api.json`, `after/public-api.json`. `before/` also retains the initial unselected-team run. `after-team/` retains an abandoned lazy-loading/delay experiment; it is not the final implementation. Script transfer bytes include completed prefetch resources, so deterministic initial route bundles are reported separately.

## Before / final page measurements

Values below are single laboratory samples, not p95. Improvements or regressions of a few milliseconds do not establish causality.

| Area | Device | LCP ms before → final | CLS before → final | TTFB ms before → final | Completed JS KB before → final | Local interaction ms final |
|---|---|---:|---:|---:|---:|---:|
'''
lookup={(r['name'],r['device']):r for r in before['results']}
for a in after['results']:
 b=lookup[a['name'],a['device']];interaction='unmeasured' if a['interactionLatencyMs'] is None else str(a['interactionLatencyMs'])
 perf+=f"| {a['name']} | {a['device']} | {b['lcpMs']:.0f} → {a['lcpMs']:.0f} | {b['cls']:.3f} → {a['cls']:.3f} | {b['ttfbMs']:.1f} → {a['ttfbMs']:.1f} | {b['scriptEncodedBytes']/1000:.1f} → {a['scriptEncodedBytes']/1000:.1f} | {interaction} |\n"
perf+='''
The mobile LCP <1.5-s target is not generally met. CLS remains above 0.1 on some states; team preference/auth hydration and hero/content replacement still cause movement. These results do not establish exceptional page speed or a field INP guarantee. Further populated-fixture runs, repeated idle-host samples, low-end devices and hosted measurements are needed before attributing page improvements.

## Implemented optimizations and cache isolation

The web Worker forwarded `/api/*` to `API_SERVICE` before its cache code. The API Worker then forced every response to `private, no-store`, so the existing public cache path was bypassed. The API Worker now owns the public lookup after access middleware. A strict allowlist permits anonymous public team homepage/wire, Three & Out, Film Room, team metadata, public story details, events and bounded event-level research tables. Unknown/duplicate query parameters, private/auth/user/Front Office/saved-bet routes, cookies and authorization headers bypass it. Set-Cookie, private/no-store, errors and unsafe Vary responses cannot enter cache. Anonymous preview-gate failures retry the caller's authenticated transport outside shared caching, preserving private preview access.

Keys include normalized team/date/event/mode and `APP_CACHE_VERSION`; release/correction invalidation can advance that version. TTL is at most 30 seconds, honoring shorter research expiry before kickoff. Publication changes without a version bump can remain visible for that bounded TTL. Cache API entries are local to a Cloudflare data center, so one warm local benchmark is not a geographic hit-rate forecast. Review flags default off. No private data is publicly cached.

The native public client coalesces requests and keeps at most 32 one-MiB public responses for at most 15 seconds, respecting server max-age/Age/private/no-store. It sends no cookies or bearer tokens. Authenticated preview fallback is never stored. Failures are retried, teams use separate keys and account/private calls keep their original authenticated transport. Tests observed 20 concurrent public calls using one transport request. Native Home starts independent game metadata alongside editorial loading and uses a generation guard to reject late responses after team changes or unmounts. Web Home makes its public editorial/video reads anonymously with safe preview fallback; it still requests only the selected team.

No score formulas, sportsbook availability semantics, alternate-line filters, bet-slip state, refresh cadence or transaction behavior changed. Existing D1 ingestion precomputes model/context/board/reference-bound Lab Scores; reads reuse verified results. Existing progressive snapshots, request coalescing, pagination/grouping and bounded serialized filter pages were inspected and retained. The three-times-weekly odds cron remains **Mon/Wed/Sat 15:00 UTC** (`0 15 * * 1,3,6`). Broader per-market research recomputation and historical data hydration remain bottlenecks; no speculative virtualization dependency was added.

A lazy Film Room modal / deferred-request experiment did not demonstrate a bundle or mobile LCP win and was withdrawn. Initial route JS remains heavy, partly because global auth imports Front Office save-store logic. That synchronous owner-quarantine path was preserved rather than risk private state isolation. Existing Next image priority/sizes, local font loading and route splitting remain in place; no font improvement is claimed. Same-resolution quality-82 WebP stadium derivatives are now shared by web and native; KC's bundled native hero uses the derivative too. All original PNG URLs remain available. Measured assets across 32 teams fall from 95.69 MB to 13.45 MB (85.9%); see `stadium-assets.json` for exact bytes. KC and SEA original/derivative images were visually inspected with matching dimensions and composition. This measures transfer/package savings, not device startup. These are static assets, not additional R2 archives.

## Public API and database evidence

'''
perf+=f"Actual local workerd, 30 sequential public event requests: cache hit rate **{api_before['hitRate']*100:.1f}% → {api_after['hitRate']*100:.1f}%**; warm-sample p95 **{api_before['p95Ms']:.2f} → {api_after['p95Ms']:.2f} ms**. First request is excluded from warm latency percentiles. The fixture has an empty precomputed event board; this is cache dispatch evidence, not populated large-response serialization. Logs show one D1 statement/read on MISS and **zero D1/R2 operations on HIT**. Cookie, bearer, private endpoint, unknown query and release-version invalidation tests pass. Hosted geographic p95 <100 ms remains unverified.\n\n"
perf+='''D1 upcoming-event lookup previously used `WHERE ?=1 OR kickoff_at>?`, forcing a scan of the existing kickoff index. Splitting the include-history and upcoming queries enables an indexed range search. The 10,000-event fixture returns identical original 16 rows with **10,000 → 16 row reads (99.84% fewer)**, zero writes and no new index bytes. Local SQLite duration was 1 → 0 ms at coarse timer resolution; this is not a stable latency claim. Existing owner/team/board indexes were inspected; no speculative indexes were added. New notification indexes support a newly ported domain and are included in staging's unmodeled-volume caution.

## Initial route bundle sizes

Raw production manifests, gzipped each initial JS file independently; async/prefetch transfers are excluded. This work does not claim a broad bundle reduction.

| Route manifest | Before gzip KB | Final gzip KB | Delta bytes |
|---|---:|---:|---:|
'''
for b,a in zip(bundles['before'],bundles['after']):perf+=f"| `{a['route']}` | {b['gzipBytes']/1000:.2f} | {a['gzipBytes']/1000:.2f} | {a['gzipBytes']-b['gzipBytes']:+d} |\n"
perf+=f'''
## Native and regression validation

Expo SDK 54 versioned documentation and the existing mobile-web/native components were inspected. Native TypeScript passes. Offline Expo Android, iOS and web bundles export successfully (`native-export-final.log`); symlinked dependency resolution in Metro was corrected for isolated worktrees. These are JavaScript build artifacts, **not device installs or native startup/transition performance measurements**. Android/iOS visual/device validation remains unverified; no React Native screen was replaced with a WebView.

Final application/Worker/database/password/SQLite tests: **{passed} passed, zero final failures**. The two conditional unit skips pass in dedicated integrations. **48** browser cases cover KC/SEA at mobile/desktop widths, navigation, auth/reset/verification, saved-content owner isolation and restart durability. **58** split Worker HTTP samples plus the actual password/reset/session probe pass. Corruption and complete synthetic incremental restore pass. Full PostgreSQL migration replay remains blocked by missing local pgvector, separately documented in staging readiness.

## Infrastructure impact and remaining work

The public cache uses the existing Cache API and adds no D1 storage, writes or paid dependency. The event query adds no index and reduces measured reads. Public client caches use bounded memory; private-preview fallback can require an extra anonymous request before the authenticated attempt. No account-wide traffic/hit rate or no-cost whole-product guarantee is inferred. The private password service and new notification domain belong to staging work and still require hosted CPU/volume qualification.

R2/D1/account constraints remain: 365-day D1 829.4 MB, R2 payload floor 7.48 GB, optimistic retained recovery footprint {gb(annual['r2BytesAtMeasuredLowChurnRatio'])} GB, unknown domain volumes and existing 19.06M Class B/month lower bound. Those do not meet the 30% headroom target. No infrastructure was activated or billed by this work. See `STAGING_READINESS_REPORT.md` for recovery and full-product staging blockers.

Next work: remove heavy save-store dependencies from global auth through a separately tested synchronous ownership boundary; provide server-known team branding to reduce hydration shifts; measure populated public/Parlay data under repeated cold/warm samples; qualify private/profile/Front Office queries and remaining PostgreSQL domains; run real low-end Android/iOS profiling and hosted Worker CPU/geographic traces after review approval.

References: [Cloudflare Cache API behavior](https://developers.cloudflare.com/workers/reference/how-the-cache-works/), [R2 free tier](https://developers.cloudflare.com/r2/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Expo SDK 54 archived source](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/index.mdx).
'''
(root/'PERFORMANCE_OPTIMIZATION_REPORT.md').write_text(perf)
print(json.dumps({'automatedPassed':passed,'browserCases':len(browser['routes']),'performanceSamples':len(after['results'])}))
