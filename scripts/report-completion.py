import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1];out=root/'reports/production-completion'
load=lambda n:json.loads((out/n).read_text())
model=load('capacity-model.json');scale=load('scale-recovery.json');saved=load('saved-storage.json');browser=load('browser-results.json')
rows=model['scenarios'];annual=next(r for r in rows if r['dau']==1000 and r['days']==365)
def tap(name):
 s=(out/name).read_text();return {k:int(re.findall(r'^# '+k+r' (\d+)$',s,re.M)[-1])for k in ['pass','fail','skipped']}
names=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log'];suites={n:tap(n)for n in names};passes=sum(s['pass']for s in suites.values())+2
horizons='\n'.join(f"| {r['days']} | {r['d1Bytes']/1e6:.1f} | {r['r2Bytes']/1e9:.2f} | {r['worstGameR2Bytes']/1e9:.2f} |"for r in rows if r['dau']==1000)
traffic='\n'.join(f"| {r['dau']:,} | {r['workerRequestsPerDayLowerBound']:,} | {r['d1ReadsPerDayLowerBound']:,} | {r['d1WritesPerDayLowerBound']:,} | {r['d1Bytes']/1e6:.1f} | {r['r2Bytes']/1e9:.2f} | {r['r2ClassAPer30DaysLowerBound']:,} | {r['r2ClassBPer30DaysLowerBound']:,} |"for r in rows if r['days']==365)
validation='\n'.join(f"| {n} | {s['pass']} | {s['fail']} | {s['skipped']} |"for n,s in suites.items())
architecture='\n'.join(f"| {count} D1 + R2 | "+' / '.join(f"{next(r for r in rows if r['dau']==1000 and r['days']==days)['d1Bytes']/1e6/count:.1f}"for days in [30,90,180,365])+f" | {'Low' if count==1 else 'High; sharding, owner routing, duplicated registries and cross-store recovery required'} |"for count in [1,2,3])
web_kib=float(re.findall(r'gzip: ([\d.]+) KiB',(out/'split-build.log').read_text())[-1])
api_kib=load('api-bundle.json')['gzipBytes']/1024
page=scale['d1Pages'];top='\n'.join(f"| {r['name']} | {r['type']} | {r['bytes']:,} |"for r in page['objects'][:8])
text=f'''# Zero-cost production completion report

Production readiness: **BLOCKED**. The complete application cannot yet run without Neon; verified D1 verticals can. No whole-product 1,000-DAU $0 claim is supported.

Isolated worktree `/private/tmp/down-distance-production-completion`; branch `poc/zero-cost-production-completion`; base `ded8b795` (retains tested Phase 4 improvements beyond the prompt's Phase 3 base). Main checkout untouched. Synthetic data only. No deployment, production database/account access, real mail/inference/provider requests, paid activation, DNS changes, or existing user/editorial deletion. PostgreSQL remains the default and rollback implementation.

## Implemented

- Additive migrations 0019–0026: owner-scoped franchise heads/commands/routes; reward rank index; reference packs; normalized odds directories/history; source-bound Lab Scores; processing leases; public editorial/history/search; daily briefings/mail jobs; indexed saved-metadata offload; compact R2 market-identity directories.
- Front Office actual route boundary now supports D1/R2: unchanged gameplay handlers, original codec/reference validation, atomic version CAS, immutable verified state before publication, exact command replay, stale/concurrent conflict rejection, failed-command rollback, event/offer adapters and restart durability. Full season/trade/draft parity and existing PostgreSQL save conversion remain unqualified; no claim that archived SQL rows are executable saves.
- Rewards dashboard, claim and redemption now use D1, including concurrent coupon claims and owner checks. Catalog seeding is lazy so restore targets remain empty. Crew rank is explicitly unavailable pending crew migration.
- Parlay board uses original normalization, books/alt lines/deep links and existing Lab Score calculations. Stored scores require matching board, model, context and reference versions; unchanged reference imports do not invalidate them. Raw scheduled publication creates durable processing tasks atomically. A service-only worker processes one event per invocation; retries never refresh the provider. Three UTC refreshes/week remain unchanged, all enable flags false.
- Public editorial, source attribution, saved story IDs, lexical historical search, withdrawal/history and deterministic Three & Out selection now have D1/R2 adapters. Reference packs support schedules, historical player/opponent stats and role evidence. Automatic production import/ingestion handoff remains incomplete.
- Search uses persisted structured evidence and optional quota-controlled Workers AI with evidence/quote validation and a second support review. Missing evidence is explicit. Malformed/unavailable inference falls back through the existing answer engine; mocks establish contracts, not hosted quality.
- Signup now stages user, credentials, identity, settings, token and encrypted verification mail in one D1 transaction. Daily briefing publication atomically creates a resumable, deduplicated fanout job when explicitly enabled. Preferences/unsubscribe and secure recovery remain integrated. Explicit 429 rejections retry with Retry-After, five-attempt ceiling and reserved quota; uncertain delivery never automatically resends.
- Public read caches are scoped by persistence source/version; request-owned state stays private. Runtime metrics record actual local D1 metadata and R2 operation counts, never substitute wall time for cloud CPU.

## Cloudflare runtime

Preserved full Node build passed. Split build keeps all 197 API route modules in a dedicated Worker and renders the original Next pages through OpenNext in a separate Worker. Temporary build staging excludes API source only from the web bundle; source routes are preserved. Web bundle is approximately **{web_kib:,.2f} KiB gzip**, API **{api_kib:,.2f} KiB gzip**, each below the **3 MiB** Free limit. This resolves the prior 3,205 KiB monolithic artifact blocker. Exact final artifacts: `split-build.log`, `api-bundle.json`.

Local workerd starts with synthetic D1/R2 and no DATABASE_URL. Homepage, Beat, Film Room, Front Office/Parlay shells, search, props, saved content, existing session and daily trivia return 200. Original-strength password auth intentionally remains 503 in Workers; no weaker hash or bypass was substituted. Disabled ingestion returns 503. Empty content responses are not evidence that populated production features are complete. `web-worker-probe.json` records the final HTTP checks, including team variants; Chromium checks separately use the preserved Node build.

Production routing should send `/api/*` directly to the API Worker and other requests to web, preserving URLs and counting account-wide requests. The local service-binding gateway adds an internal hop; neither this topology nor smaller bundles creates extra account quotas. Node/Edge build warnings, cloud startup/memory and strong password CPU remain staging blockers.

## Storage root cause and measured results

Archiving bodies alone cannot bound retained indexed row populations. Prior day-365 D1 envelopes include 321.2 MB editorial directories, 102.4 MB accounts/preferences, 74.8 MB sessions/security, 186.9 MB trivia/points, 224.3 MB saved content/slips, plus receipts/mail/keys. These are projections, not production table measurements. Compression of R2 does not reduce SQLite indexes or these D1 rows. Immutable objects and old checkpoint directories also remain cumulative; orphaned objects are deliberately preserved in frozen backup inventories.

New safe reductions: saved metadata above 512 bytes goes to verified R2 rather than the previous 32 KiB threshold; bounded legacy offload uses original-row CAS, retains every saved row/ID, and has a partial index. Synthetic metadata column bytes: **{saved['beforeColumnBytes']:,} → {saved['afterColumnBytes']:,}** for {saved['savedRecords']} records, identical retrieval and owner isolation. This is not an immediate SQLite file-size reduction: freed pages can be reused. Maintenance remains disabled and uses a smaller token batch so combined work stays within 50 statements.

New market identities share a content-addressed R2 directory per event rather than one indexed D1 row per market. Existing legacy IDs remain readable and are never deleted; disappeared/reappearing markets retain IDs. Under the explicit 2,000-identities/event planning envelope this avoids approximately {annual['avoidedIndexedMarketIdBytes']/1e6:.1f} MB of additional annual indexed metadata. The new public directories and briefing rows are included rather than hidden. These changes do **not** prove a below-350-MB whole-product database.

Measured current synthetic recovery database: **{page['sqliteBytes']:,} bytes**, {scale['checkpoint']['tables']} tables, {scale['checkpoint']['rows']:,} rows; complete table/index/column/page inventory is embedded in `scale-recovery.json`. This fixture contains 5,000 users and deliberately retains legacy inline saved metadata; it is not one year of traffic or a claim that all rows already used the new offload path. Largest allocated objects:

| Object | Type | Bytes |
|---|---|---:|
{top}

## Projections and architecture comparison

**PROJECTED**, at 1,000 DAU; decimal MB/GB, ordinary compression assumptions, two private payload copies, all daily checkpoint directories retained, no credit for changed-checkpoint reuse. Worst case substitutes the measured 2.1-MB high-entropy game shape. Unknown domains remain `null`, never zero.

| Days | D1 MB | R2 GB | Worst-game R2 GB |
|---|---:|---:|---:|
{horizons}

Before: inherited modeled D1 **927.2 MB**, R2 **52.51 GB**. After, with newly modeled public/odds/briefing domains and saved-metadata reductions: D1 **{annual['d1Bytes']/1e6:.1f} MB**, R2 **{annual['r2Bytes']/1e9:.2f} GB** at day 365. More complete coverage is not directly comparable to the original archival-only 828.5-MB forecast.

| Architecture | Best-case MB/database: 30 / 90 / 180 / 365 days | Complexity |
|---|---|---|
{architecture}
| PostgreSQL + aggressive caching | Same logical retained dataset; PostgreSQL physical bytes unmeasured | Keeps SQL transactions; cache invalidation, provider plan/compute and Worker networking remain unqualified |

Two/three D1 values assume perfectly balanced partitions and omit duplicated registries: they are storage counterfactuals, not implemented safe sharding. All D1 variants share the same daily reads/writes, R2 storage/operations and CPU uncertainty; sharding adds routing and reconciliation rather than write allowance. PostgreSQL uses no D1 rows on its retained path, but SQL/query/compute charges and cache hit rate remain unknown. Select the **single staged D1 + R2 implementation locally**, retaining PostgreSQL rollback. No compared architecture is qualified to meet the complete free-tier target.

Verified October 18, 2026: D1 **500 MB/database**, **5 GB/account**, **5M reads/day**, **100k writes/day**, **50 queries/invocation** ([pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/)); R2 Standard **10 GB**, **1M Class A / 10M Class B monthly** ([pricing](https://developers.cloudflare.com/r2/pricing/)); Workers Free **100k requests/day**, **10 ms CPU/request**, **3 MiB compressed/Worker** ([limits](https://developers.cloudflare.com/workers/platform/limits/)). Internal 350-MB/7-GB targets reserve 30% headroom; they are not provider limits. Existing account workloads are unknown.

| DAU | Worker requests/day* | D1 reads/day* | D1 writes/day* | D1 MB/365d | R2 GB/365d | R2 A/month* | R2 B/month* |
|---|---:|---:|---:|---:|---:|---:|---:|
{traffic}

*Planning lower bounds. CPU is **UNVERIFIED** for every row. AI inherits a 7,000-neuron/day reservation assumption; two-pass synthesis needs real workload qualification. Sports reservations remain 780 objects/31 days at two pages/slot, above the configured 700 headroom ceiling; the limiter defers rather than increases refresh cadence. No entire-product $0 DAU is established; projected monthly production cost remains unknown. No new infrastructure charges were incurred by these local runs.

At 1,000 DAU the first known fixed launch failures include password capability and single-D1 size; retained R2 storage/Class B and email also fail. D1 writes need at least **{annual['d1WritesPerDayLowerBound']-70000:,}/day** reduction for headroom. R2 needs approximately **{annual['r2Bytes']/1e9-7:.2f} GB** less retained storage and **{(annual['r2ClassBPer30DaysLowerBound']-7000000)/1e6:.2f}M** fewer monthly Class B operations. An eight-directory policy alone is an unimplemented counterfactual, not permission to remove rollback history. A delta/streaming backup and approved recovery contract must demonstrate those reductions.

Subscriber capacity is separate: implemented sender reserves 30% of 100/day and 3,000/month, with 10 transactional sends/day. That permits at most **60 daily editorial recipients**, or **57 sustained recipients in a 31-day month** with that reservation. At 10% subscribing, the email-only bound is about 570 DAU; it is not whole-product capacity. Live sender/domain/provider enrollment and designated test-recipient validation remain undone.

## Backup, recovery and performance

Latest scaled rehearsal: **{scale['users']:,} users**, {scale['savedBets']:,} saved bets, {scale['gameVersions']} shared-document game versions, 100 new franchise graph heads, stored references and typed odds IDs, {scale['checkpoint']['tables']} tables, **{scale['checkpoint']['rows']:,} rows**, **{scale['checkpoint']['objects']:,} objects**. All original IDs and checksums preserved; FK checks pass. Backup {scale['checkpoint']['milliseconds']/1000:.2f}s, restore {scale['restore']['milliseconds']/1000:.2f}s locally. Interrupted backup/restore, replay and unchanged-checkpoint reuse pass; unchanged checkpoint adds zero object writes. Complete operation counts, directory bytes, worst-size case and recovery timings are in `scale-recovery.json`. Corruption/missing-tree and cross-store tests are included in the Worker suite.

This is **offline recovery with stopped writers and an unserved target**, not an online production backup SLA. Current rehearsal ceilings: 64-MB logical SQLite snapshot, 8-MB individual object, 4-MB application tree, 512 nodes/tree. Streaming larger datasets and online fencing remain blockers. The script's reference fixture verifies graph preservation, not gameplay validity for every synthetic aggregate. Actual gameplay routes are tested separately.

Measured Front Office route cases use at most 10 D1 statements; normal create/mutate, duplicate receipt replay, failed mutation, conflict, isolation and restart pass. The odds processor test enforces 50 statements/event. Actual split-Worker HTTP checks also create a franchise (7 statements, 275 R2 reads/98 writes; 323-ms local wall time in this run), replay its exact response, and read it back. All 32 team variants return 200; 58 HTTP samples and eight capability assertions pass. Local Worker JSON records D1 rows, R2 reads/writes, status and wall latency. Production CPU, startup, memory and p95 under real concurrency remain **UNVERIFIED**, including large saves and whole-event precomputation. Normalized boards above the 4-MB tree ceiling fail without replacing the prior verified board; the raw scheduled history remains retained. Streaming normalized boards are still required for larger events. `wallMs` is never reported as CPU.

## Validation

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
{validation}
| SQLite page accounting | 2 | 0 | 0 |

**{passes:,} passed, {sum(s['fail']for s in suites.values())} failed**. Two standalone conditional skips execute successfully in dedicated database integrations; they are not counted twice. Chromium: **{len(browser['routes'])} route/viewport cases**, 0 failures, plus account/restart/HTTP checks. It uses synthetic partial PostgreSQL schemas and checks KC/SEA at mobile/desktop widths; missing optional tables do not establish populated Huddle/commerce parity. Android/iOS were not built or device-validated; no renderer/UI source changed. Worker HTTP samples are separate from browser tests. Root and combined application/API Worker TypeScript checks pass. The separate full PostgreSQL migration experiment remains blocked at migration 017 because local pgvector is unavailable; the dedicated synthetic database suites pass and do not qualify the entire PostgreSQL schema. Build and final local runtime evidence are linked in `reports/production-completion/`.

## Remaining blockers and next integration

1. Complete executable migration/import and route parity: Huddle/crews, Film Room/provider/video persistence, commerce, push/security/admin operations, existing Front Office saves/recovery, full lifecycle/season operations, transfer reservations and editorial automatic ingestion/overrides still have PostgreSQL or process-local dependencies. The 50-table lossless synthetic importer preserves raw originals; it does not make every archived table executable in D1. Front Office, FanDuel/DraftKings provider contracts still retain PostgreSQL rollback tests; D1 book availability/deep links are not verified sportsbook transfers.
2. Qualify original-strength password hashing in Workers, and then all security/rate-limit/session flows. Hosted CPU requires separately approved staging; no deployment authorization is implied by this report.
3. Implement measured delta/streaming backup and required history contract, reduce daily write amplification, qualify sharding only with cross-domain integrity and owner routing. Unknown Huddle/commerce/push/video/reference volumes prevent any whole-product capacity certificate.
4. Validate hosted AI outputs/citations/quality and real provider quotas; verify sender domain, designated recipient recovery and unsubscribe delivery. Keep odds, email, maintenance, AI and ingestion enable flags false until review.

Configuration templates: `config/zero-cost-production.*`. Placeholder IDs, no routes/account, all cron arrays empty. Required secrets are documented and unset. Local build: `node scripts/build-split-worker.mjs`; tests: `python3 scripts/qualify-completion.py`, `node scripts/qualify-completion-workers.mjs`, `python3 scripts/qualify-completion-postgres.py --browser`; recovery from worker directory: `TSX_TSCONFIG_PATH=../../tsconfig.test.json node --import tsx scripts/completion-scale.ts`.

**Staging preparation after separate approval only:** copy templates to reviewed configuration, set real staging D1/R2/service bindings and existing secrets through `wrangler secret put`, apply migrations with `wrangler d1 migrations apply APP_DB --remote --config <reviewed-staging-config>`, then `wrangler deploy --config <reviewed-staging-config>` for API/private processor before web. These commands were **not run**. Route `/api/*` to API; keep scheduled flags/cron disabled. Seed synthetic owned fixtures and inspect existing `application_headers` logs plus Cloudflare TraceEvent `CPUTimeMs`, startup, memory, error rates and D1/R2 account totals. Check `/api/auth/config`, authenticated `/api/auth/me`, public pages, D1 writes/R2 restart retrieval and stale/conflict responses; a healthy shell must not mask unavailable capabilities.

Rollback: stop new writers/jobs, preserve current D1/R2 and manifests, restore reviewed PostgreSQL-backed Node release and its original environment; never assume dual-write or automatic replay of D1-only commands. Reconcile changes from verified receipts before reopening writes. Migrations are additive; do not drop new tables or immutable objects during rollback.

A final rerun initially exhausted local temporary disk space; only session-generated build copies were removed, automatic cleanup was added, and affected build/recovery checks were rerun. Earlier failed probe requests omitted the required version precondition; the corrected HTTP checks retain that security requirement.

Review this isolated commit. Production remains **BLOCKED**; no deployment performed.
'''
(root/'ZERO_COST_PRODUCTION_COMPLETION_REPORT.md').write_text(text)
print(json.dumps({'suitePasses':passes,'suiteFailures':sum(s['fail']for s in suites.values()),'browser':len(browser['routes']),'d1Bytes365':annual['d1Bytes'],'r2Bytes365':annual['r2Bytes']}))
