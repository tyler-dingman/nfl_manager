import runpy,re,json,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
n=runpy.run_path(str(ROOT/'scripts/report-phase-three.py'))
OUT=n['OUT'];write=n['write'];read=n['read'];tests=n['tests'];model=n['model'];benchmark=n['benchmark'];migration=n['migration'];recovery=n['recovery'];worker=n['worker']
upload=re.findall(r'Total Upload: ([\d.]+) KiB / gzip: ([\d.]+) KiB',(OUT/'cloudflare-build.log').read_text())
compressed=upload[-1][1] if upload else 'UNVERIFIED'
probe_rows='\n'.join(f"| {r['name']} | {r['attempt']} | {r.get('status',r.get('error'))} | {r.get('localWallMs',0):.2f} |" for r in worker.get('results',[]))
write('CLOUDFLARE_HOSTING_IMPLEMENTATION.md',f'''# Cloudflare hosting implementation

**PARTIALLY RESOLVED; not a qualified production host.** Next server rendering, middleware, dynamic team pages, auth APIs, SEO metadata and client navigation require a server runtime. Static export/SPA fallback cannot preserve them. The local experiment uses OpenNext Workers + Static Assets; mobile screens remain React Native.

Implemented: explicit Cloudflare build/dry-run commands; isolated sentinel Wrangler resources; compatibility flags; request-scoped D1/private R2 bindings; a separate disabled scheduler entry; Static Assets; response security headers and private/no-store policies for cookies/auth/APIs. No paid DO/KV/Queue cache is configured. OpenNext cache/queue providers are dummy implementations; repeated SSR/ISR costs remain unqualified. Framework routing owns APIs; a SPA fallback does not conceal missing handlers.

Next moves from 14.2.5 to patched 14.2.35. The experiment pins legacy OpenNext 1.8.3 to preserve current App Router/React 18 contracts during isolated work. Current adapters require a newer Next version. **Next 14/this old adapter are not a supported production recommendation.** A supported framework/adapter upgrade and renewed auth/dynamic-route/SEO/cache/native-API checks remain required. [OpenNext compatibility](https://opennext.js.org/cloudflare)

Native Argon2 initially blocked bundling. The Worker-specific module explicitly rejects password hashing; Node retains original Argon2id memory/time/parallelism/output parameters and existing hashes. Worker password login/signup/reset/recovery return 503 and are not advertised as available. This is an unavailable capability, not weaker hashing or completed auth hosting.

The first workerd probe failed in the legacy adapter's process.chdir call. The documented disable_nodejs_process_v2 flag restores its expected process surface locally. A second probe reproduced Workers rejecting redirect:error. Middleware/provider/RPC calls now use manual redirects and reject non-success responses before forwarding credentials. Authentication gates were preserved. [Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [process behavior](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)

Latest dry-run compressed Worker: **{compressed} KiB**. It is close to the Free compressed bundle ceiling and lacks 30% size margin. The local build contains 1,770 static files; checked assets fit per-file/count bounds. Actual account asset quotas remain unverified. Local self-fetch success also does not establish same-zone deployment behavior: use an approved Custom Domain/service-binding design for authentication self-requests; routes alone may reject Worker-to-Worker fetches. Packaging success does not establish working data APIs or CPU compliance.

## Actual local Worker responses

A new local D1 is migrated and seeded with one synthetic opaque session. No account/provider credentials are available. Cold/warm HTTP wall time is measured outside workerd. Known 503/empty-data responses remain visible; they are not counted as functional features.

| Family | Attempt | Status | Local HTTP wall ms |
|---|---|---|---|
{probe_rows}

Existing session validation, saved-ID access and lexical search exercise actual local D1 bindings. Password capability checks remain explicitly unavailable. Full PostgreSQL-dependent APIs, actual provider/OAuth exchanges, private-list R2 fanout bounds, production cache/startup/memory/billed CPU and supported framework versions remain blockers. Authenticated SSR 200 responses on a small fixture do not establish complete feature data.

No production API/database, deployment, account change, paid activation or real mail occurred. There is no cloud preview. Before proposing one, prepare supported versions, complete critical routes, exact synthetic resource IDs/secrets and rollback artifacts, then obtain separate preview approval. Committed configurations intentionally contain no usable production IDs/routes.
''')
route_metrics=read('d1-route-metrics.json',{}).get('measurements',[])
metrics_rows='\n'.join(f"| {r['path']} | {r['status']} | {r['localWallMs']:.2f} | {r['d1Calls']} | {r['rowsRead']} | {r['rowsWritten']} |" for r in route_metrics if r['status'] in [200,201])
http_rows=[]
for row in read('route-benchmarks.json',{}).get('benchmarks',[]):
 samples=row['samples'];times=[r['localHttpWallMs'] for r in samples]
 http_rows.append(f"| {row['name']} | {','.join(str(r['status']) for r in samples)} | {statistics.median(times):.2f} | {max(times):.2f} |")
write('WORKER_PERFORMANCE_PHASE_3.md',f'''# Worker performance — Phase 3

**Actual Cloudflare Worker CPU: UNVERIFIED.** No cloud preview or production invocation was run. Node/Miniflare/workerd wall time is not billed CPU. Workerd timers can remain zero inside one I/O turn; no Free CPU compliance is inferred from them.

Instrumented D1 operations use actual returned rows_read/rows_written metadata and statement/call counts. R2 counters include initial existence lookups and verification reads. The Worker logs sanitized route families, status, wall-to-headers, D1/R2 operations and an explicit null CPU field. Header-time metrics omit some later streaming/background work and are a lower bound, not full-invocation accounting.

Cloudflare publishes CPUTimeMs separately from WallTimeMs. The JSONL trace parser computes route-family CPU p50/p95/p99/max, rejects wall-only observations and strips private paths/query tokens. A synthetic parser test cannot qualify production CPU. Collect sufficiently sized provenance-verified cloud exports for every required path. No billed Tail Worker/Logpush sink was enabled. [Timing fields](https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## Actual local Next handlers on D1

| Handler | Status | Node wall ms | D1 calls | Rows read | Rows written |
|---|---|---|---|---|---|
{metrics_rows}

Standalone preference reads perform one indexed read and zero writes; the previous ensure-settings no-op write is absent. Other improvements include batched metadata CAS, shared inference/source keys, coalesced freshness reads, bounded mail pages/drains and durable duplicate job exclusion. They do not complete unported relational gameplay or score-precompute transactions.

## Local production Node HTTP benchmark

Five requests per family on partial synthetic PostgreSQL. Failed AI/odds responses and ingestion admission rejection remain unavailable paths, not successful-work benchmarks. Bet Slip uses the real My Plays route; it does not execute a real bet.

| Family | Observed statuses | Median wall ms | Max wall ms |
|---|---|---|---|
{chr(10).join(http_rows)}

Cold/warm local workerd observations are in CLOUDFLARE_HOSTING_IMPLEMENTATION.md. Original editorial operation measurements remain inherited Phase 2 evidence, not rerun cloud CPU. Ingestion admission timing measures rejection only; local D1 tests exercise actual jobs/archives. A real Worker ingestion CPU measurement remains required.

The 100-account fixture performs {benchmark.get('d1Calls')} D1 calls, {benchmark.get('statements')} statements, {benchmark.get('rowsRead')} row reads and {benchmark.get('rowsWritten')} row writes, with six saved records/account, one session/account and eleven retained high-entropy game revisions. R2: {benchmark.get('r2',{}).get('reads')} reads, {benchmark.get('r2',{}).get('writes')} writes and {benchmark.get('r2',{}).get('writtenBytes')} uploaded bytes across two verified copies. These offline loops are not single Worker invocations.

Before launch, collect actual CPU/startup/memory/error/cache metrics for Homepage, Beat, Film Room, AI Search, Front Office, Parlay Lab, Trending Props, Bet Slip, auth and ingestion. Free internal-service subrequests have a separate 1,000 limit; external fetches are limited to 50, and D1 query limits are separate. Free CPU is per invocation; additional D1 databases do not enlarge it. Unqualified hashing and unbounded large private-list R2 fanout remain blockers.
''')
known=next(r for r in model['scenarios'] if r['dau']==1000 and r['days']==365)
blockers=[
 ('Baseline failures','17 failures/two conditional skips','RESOLVED','Applicable suites pass; both skips execute separately','Retain clean runners and behavioral coverage'),
 ('Full Cloudflare host','No compatible artifact/runtime proof','PARTIALLY RESOLVED','Local build/dry-run and authenticated SSR/API probes','Supported framework/adapter; complete data-backed endpoints'),
 ('Free Worker CPU','Unmeasured','UNVERIFIED','Trace parser, D1/R2 metrics and local benchmarks','Approved synthetic cloud CPU/startup/memory traces'),
 ('PostgreSQL/polling','Neon authoritative','PARTIALLY RESOLVED','Ten staged source mappings, raw import and explicit D1 dispatch','Port gameplay/rewards/odds/editorial; replace polling only after validation'),
 ('Worker password auth','Original-strength hashing unqualified','BLOCKED','Node-on-D1 passes; Worker capability deliberately 503','Supported secure hashing within qualified runtime limits'),
 ('AI/voice','No qualified free inference','PARTIALLY RESOLVED','Shared cache/quota/FTS and concrete opt-in AI adapter','Hosted quality/billing calibration, complete answers and voice strategy'),
 ('Recovery/subscription mail','No delivery adapter; volume gap','PARTIALLY RESOLVED','Queue/provider/UI/opt-out implemented; 60 daily editorial sends','Actual delivery/publication integration; Broadcasts consent/segment/webhook sync'),
 ('Three-weekly odds','Primitive only','PARTIALLY RESOLVED','Concrete provider wrapper, durable quotas, snapshots/freshness','D1 board/Lab Score integration, reconciliation, provider/partner qualification'),
 ('Cross-store recovery','Small lean-only fixture','PARTIALLY RESOLVED','61-table/large-object cold restore with interruption','Streaming/off-account/key/cutover/retention rehearsal'),
 ('Native devices/push/provider actions','Unverified','UNVERIFIED','Offline iOS/Android JS bundles; 48 web viewport checks','Device deep links/errors/push and real sportsbook actions'),
 ('Whole-product/multi-year growth','Editorial-only limits exceeded later','BLOCKED','Full-category scenario subtotal and measured worst game shape','Reduce retained metadata/version/backup/write amplification without losing data'),
 ('Account limits/rights/distribution','Unverified','UNVERIFIED','Public official quotas only; no account access','Account-wide resources, permissions, CI/store/voice/push costs')]
blocker_rows='\n'.join('| '+' | '.join(row)+' |' for row in blockers)
scenario=(OUT/'capacity-model.md').read_text().replace('# Phase 3 planning scenario subtotal','### Capacity scenarios')
write('ZERO_COST_PRODUCTION_READINESS_PHASE_3.md',f'''# Down & Distance — Zero-Cost Production Readiness, Phase 3

## 1. Executive summary

**Production readiness: BLOCKED. Supporting 1,000 DAU at $0 is not demonstrated.** This phase implements and tests staged D1 account adapters, raw PostgreSQL import, API recovery, shared AI caching, mail infrastructure, concrete three-weekly odds ingestion and multi-batch cross-store recovery. It resolves the original test baseline. Major business-data migration, supported hosting, billed CPU and providers remain unqualified.

The Phase 2 1,291-DAU number was an editorial Cloudflare component estimate, not whole-product capacity. At 1,000 DAU, the day-365 **modeled data subtotal** is {known['d1Bytes']/1e6:.2f} MB D1 / {known['r2Bytes']/1e6:.2f} MB R2, before unquantified domains. Neither fits Free storage targets. The measured worst game-state shape raises R2 further. Existing history was not deleted to make the model fit.

Worktree: `/private/tmp/down-distance-zero-cost-phase-3`; branch `poc/zero-cost-production-readiness-phase-3`; base `87101164`. PostgreSQL remains the default backend. No production access/deployment, paid activation, real sending or provider execution occurred. Stop for review after the local commit; this report does not authorize cutover.

## 2. Changes implemented

Additive migrations and reversible dispatch retain original PostgreSQL modules. Owner-scoped immutable documents/CAS, IDs and hashes preserve recovery integrity. The final security regression separates user metadata from server-owned R2 pointers and verifies owner/content-ID envelopes. Actual Next handlers exercise account/session/password/preferences/saved-slip flows on local D1. Web and native recovery/freshness use shared logic. Local build/config/instrumentation and clean fixture runners make gaps reproducible. Existing newly registered sources stay disabled pending rights/capacity qualification.

The 100-account benchmark adds {benchmark.get('incrementalD1Bytes')} D1 bytes with its stated fixtures, about {benchmark.get('incrementalD1Bytes',0)/100:.0f} bytes/account at that small population. Eleven high-entropy 2.1 MB game versions upload {benchmark.get('r2',{}).get('writtenBytes')} bytes across two copies. R2 history still grows even when D1 holds only heads/receipts. The 4 MB application limit refuses larger commands without advancing the prior head; it never discards old state.

## 3. PostgreSQL migration results

{migration.get('archivedRows')} populated rows from {migration.get('sourceTables')} synthetic source tables are retained losslessly; {migration.get('typedRows')} typed target rows are imported. Ten source table families have staged mappings; no whole-product cutover occurred. Original IDs/hashes and source fingerprints survive restart/rollback rehearsals. The inventory covers 115 historical declarations and detected SQL/connection sites, with dynamic-review gaps explicit. Most business tables retain PostgreSQL. **Verified Neon compute eliminated: 0.** See POSTGRESQL_TO_D1_MIGRATION_RESULTS.md before selecting D1 globally.

## 4. Hosting implementation

OpenNext/Static Assets configuration, build/dry-run and local runtime probes execute. The legacy adapter needs a documented process compatibility flag; manual redirects fix a concrete middleware failure. Next 14/old OpenNext and original-strength Worker password auth remain blockers. The Worker is {compressed} KiB compressed; no cloud preview/deployment occurred. Static export cannot replace required APIs/SSR. Every local response, including unavailable endpoints, is in CLOUDFLARE_HOSTING_IMPLEMENTATION.md.

## 5. Worker performance

Actual D1 metadata/R2 instrumentation, ten-family local HTTP benchmarks and a privacy-filtering cloud CPU export parser are implemented. Wall time/zero workerd timer ticks are not CPU; streaming can exceed header-time counters. Free CPU/startup/memory/cache behavior remains UNVERIFIED. See WORKER_PERFORMANCE_PHASE_3.md.

## 6. AI architecture

Source-versioned shared results and D1 leases/quota reservations prevent repeated team generation. The opt-in Workers AI summarizer validates output/citation IDs; configured providers fail explicitly instead of substituting invented summaries. FTS returns real lexical results/attribution, with unknown timestamps/classification labeled unavailable. Structured/vector answers remain unavailable in D1 mode. Hosted quality/account usage and AI/voice functions remain unqualified. A 200-generation example reserves 7,000 estimated neurons/day, not observed billing. See ZERO_COST_AI_IMPLEMENTATION.md.

## 7. Email implementation

Encrypted deduplicated staging, recovery/UI flows, a concrete provider, preference/opt-out checks, bounded drains and uncertain-failure handling execute locally. Actual delivery/publication wiring is unfinished. Implemented conservative tier: 60 daily editorial recipients plus ten transactional attempts. Verified public Broadcasts terms provide a separate potential 1,000-contact tier, or 700 with margin; consent/segment/webhook integration and actual entitlement remain unverified. This phase does not claim 1,000 subscribed users receive mail. See EMAIL_DELIVERY_IMPLEMENTATION.md.

## 8. Parlay Lab scheduling

Three odds windows/week are declared with provider flags disabled. The existing-client wrapper reserves quota before requests, preserves alt/book payloads, publishes verified R2 references and records partial/uncertain/missed status. Web/native freshness never calls unknown odds live. Per-event mirrored R2 work still needs CPU/memory qualification; internal-service and external-fetch allowances are accounted separately. Current board endpoints, Lab Score precompute and transfer/grade queues still need complete D1 integration; actual partner/provider execution is unverified. See PARLAY_LAB_SCHEDULING_RESULTS.md.

## 9. Backup and recovery

Cold all-logical-table D1 + full-primary-namespace R2 recovery executes locally, with large game state, saved IDs, original auth metadata, history, configuration and writer epochs. Body backups are shared between manifests; encrypted directory chunks/resume receipts remove the previous single-50-statement restore limit. The rehearsal restores 61 tables/{recovery.get('backup',{}).get('rows')} rows and {recovery.get('backup',{}).get('objects')} objects after an interruption. It is not an online/full-production/off-account recovery qualification. Memory/row limits, retention and serving/cutover gates remain blockers. See CROSS_STORE_RECOVERY_RESULTS.md.

## 10. Integration test results

{tests}

The 48 Chromium cases cover Homepage, Beat, Film Room, Parlay Lab, account, Three & Out, Huddle, Trivia, rewards, Front Office and recovery/verification at 1440/390 widths with KC/SEA contexts. These include empty/error states on partial synthetic PostgreSQL, not feature data completeness. Invalid-link forms remove URL tokens; D1 handler tests separately exercise success. Mobile reset errors and Seattle desktop Parlay freshness were visually inspected. Native screens remain React Native; iOS/Android JS bundles compile offline. Devices/simulators, push, universal links, actual AI/email/sportsbook actions and cloud CPU remain unverified.

Full SQL migration stops at local pgvector availability. Native API contracts have account bearer/preferences/saved-slip coverage. Unported sports/game/trivia APIs are not declared migrated merely because Node tests pass.

## 11. Remaining blockers and comparison

| Blocker | Phase 2 status | Phase 3 status | Evidence | Next action |
|---|---|---|---|---|
{blocker_rows}

The resolved baseline is local test reliability. Other areas have executable partial replacements; no production blocker is marked resolved from a quota spreadsheet alone.

## 12. Updated infrastructure costs

Incremental local infrastructure spend: **$0**. Projected production monthly cost: **UNVERIFIED; the 1,000-DAU scenario does not fit $0 allowances.** No paid fallback/account activation occurred.

Account-wide Free budgets used: D1 5M reads/day, 100k writes/day, 5 GB total and 500 MB/database; Workers 100k requests/day and 10 ms CPU/invocation; R2 Standard 10 GB, 1M Class A and 10M Class B/month; Workers AI 10k neurons/day. Other account workloads share these allowances. More D1 databases do not multiply daily reads/writes. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

The scenario assumes ten registered accounts/DAU, retained session/audit/trivia/points/slip/command/mail history, 0.5% active Front Office players making five commands/day, 100 KB normal game documents, 16 odds events/refresh at 100 KB/event, 200 shared summaries/day, two body copies and eight encrypted directory copies. Only fixture account bytes and the 2.1 MB worst game shape are measured. Actual per-table populations, legacy/vector/commerce/Huddle/private attachments beyond those envelopes, voice/push/CI/distribution/provider costs, conflicts and indefinite checkpoint retention are additional unknowns, not zero-cost assumptions.

The forecast charges daily verification of retained private immutable backup objects. Old AI/mail/version objects are not garbage-collected; derived caches also create cumulative cost. Eight directory copies are a planning assumption, not implemented pruning. Daily full backup needs streaming/exclusive orchestration beyond the fixture tool; no production backup scheduler is claimed.

## 13. Updated maximum sustainable DAU

**Whole-product verified maximum at $0: NOT ESTABLISHED. No launch capacity is certified.** All requested horizons/DAU scenarios and component assumptions are in capacity-model.json. At the smallest 100-DAU scenario, D1 storage/writes and R2 inventory reads exceed 30%-margin budgets. At 1,000 DAU the D1 database cap, R2 storage and operation quotas also fail. CPU/provider/domain unknowns can constrain capacity further.

{scenario}

At 1,000 DAU/day 365, one D1 needs {known['d1Bytes']/1e6:.1f} MB. Two perfectly balanced stores hold {known['d1Bytes']/2e6:.1f} MB each, above the 350 MB margin. Three hold {known['d1Bytes']/3e6:.1f} MB each but share daily writes/reads and the same {known['r2Bytes']/1e6:.1f} MB R2 requirement. Cross-database consistency/recovery adds complexity without fixing those account-wide failures. PostgreSQL with caching is unqualified; caching cannot eliminate retained history or the still-active polling dependency.

## 14. Recommended next phase

Review the isolated commit, then complete end-to-end D1 verticals with exact route/transaction equivalence and historical fixtures. Prioritize Front Office shared-reference/delta storage, trivia/reward atomicity, odds board/Lab Score publication and lower-write queues. Use a supported framework/adapter and qualify original-strength password auth before any Free cloud preview. Implement Broadcasts consent/segment/webhook synchronization if that verified tier is selected. Add streaming, reference-safe backup/retention tooling and rerun full byte/operation projections before proposing a launch capacity.

Scope cloud/provider verification only after the exact supported artifact and synthetic resource/rollback specification are reviewable. Preserve PostgreSQL/history/current schedules until replacements pass. Do not deploy or remove data from this POC's estimates. Stop for review.
''')
