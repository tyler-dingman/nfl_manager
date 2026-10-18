"""Generate Phase 4 review artifacts from measured evidence and explicit assumptions."""
import json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/zero-cost-phase-4'
load=lambda n:json.loads((OUT/n).read_text())
scale=load('scale-recovery.json');model=load('capacity-model.json');scenarios=model['scenarios']
one=next(r for r in scenarios if r['dau']==1000 and r['days']==365)
def write(name,text):(ROOT/name).write_text(text.strip()+'\n')
def tap(n):
 text=(OUT/n).read_text();return {k:int(re.findall(r'^# '+k+r' (\d+)$',text,re.M)[-1]) for k in ['pass','fail','skipped']}
logs=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log']
suites={n:tap(n) for n in logs};passed=sum(v['pass']for v in suites.values())+2
browser=load('browser-results.json');probe=load('local-worker-probe.json');imported=load('postgres-d1-import.json')
build=(OUT/'cloudflare-build.log').read_text();size=re.findall(r'gzip: ([\d.]+) KiB',build)[-1]
horizons='| Days | D1 MB | R2 GB, all daily checkpoints | R2 GB, hypothetical eight directories | Worst-game R2 GB |\n|---|---:|---:|---:|---:|\n'+'\n'.join(f"| {r['days']} | {r['d1Bytes']/1e6:.2f} | {r['r2BytesConservativeAllCheckpoints']/1e9:.2f} | {r['r2BytesCounterfactualEightDirectories']/1e9:.2f} | {r['r2BytesWithWorstHighEntropyGameVersions']/1e9:.2f} |"for r in scenarios if r['dau']==1000 and r['days']<=365)
capacity='| DAU | Worker requests/day | D1 reads/day, lower bound | D1 writes/day, lower bound | D1 MB, 365d | R2 GB, 365d | R2 A/month, lower bound | R2 B/month, lower bound |\n|---|---:|---:|---:|---:|---:|---:|---:|\n'+'\n'.join(f"| {r['dau']} | {r['workerRequestsPerDay']:,} | {r['d1ReadsPerDayLowerBound']:,} | {r['d1WritesPerDayLowerBound']:,} | {r['d1Bytes']/1e6:.2f} | {r['r2BytesConservativeAllCheckpoints']/1e9:.2f} | {r['r2ClassAPer30DaysLowerBound']:,} | {r['r2ClassBPer30DaysLowerBound']:,} |"for r in scenarios if r['days']==365)
validation='| Suite | Passed | Failed | Skipped |\n|---|---:|---:|---:|\n'+'\n'.join(f"| {n} | {v['pass']} | {v['fail']} | {v['skipped']} |"for n,v in suites.items())+'\n| SQLite pages | 2 | 0 | 0 |'
common='Worktree `/private/tmp/down-distance-zero-cost-phase-4`, branch `poc/zero-cost-production-readiness-phase-4`, base `8adafd53`. No production access, deployment, paid activation, real provider calls or existing user-data deletion. PostgreSQL remains the default and rollback implementation. All binding mutations use synthetic local data.'
write('PHASE_4_STORAGE_OPTIMIZATION.md',f'''# Phase 4 storage optimization

{common}

## Root causes and implemented changes

Phase 3 D1 day-365 subtotal: 935.75 MB. The inherited editorial directory is 321.21 MB; accounts/preferences 102.40 MB; sessions/security history 74.75 MB; trivia/points 186.88 MB; saved slips/content 224.26 MB; receipts 2.34 MB; mail/subscriptions 14.02 MB; AI/odds keys 9.82 MB. These are planning envelopes, not production table measurements. Full D1 payload copies are not the only problem: indexed retained row populations themselves grow. Accounts and saved history cannot be treated as disposable.

Implemented: SHA-256 identity over original bytes, optional gzip with bounded decoding and old raw-object reads; server-owned JSON subtree nodes sharing unchanged content across revisions/users; compressed plaintext before randomized authenticated directory encryption; verified encrypted chunk reuse; unchanged checkpoint reuse; bounded expired derived-AI-key maintenance; exact consumed-token archival before removing expired capabilities from D1; additive indexes and compact odds-history directory with timestamp paging. No garbage collection of user/game/editorial bodies is enabled. No paid cache is added.

Measured ordinary game fixture: {scale['gameHistory']['legacyLogicalBytes']:,} full-snapshot logical bytes versus {scale['gameHistory']['physicalPrimaryBytes']:,} primary physical bytes ({scale['gameHistory']['ratio']:.2%}). This is a shared-player synthetic fixture, not a general compression guarantee. All 401 game versions remain recoverable; a high-entropy 2.1 MB state is included separately. {scale['gameHistory']['r2Reads']/400:.1f} R2 reads per ordinary commit in this fixture includes write/read-back verification. Sharing reduces storage but adds object operations. A 128 KB leaf ceiling / 64,000-character string split bounds the worst-size object fanout; production CPU remains unverified.

## Dataset inventory and workload assumptions

No production datasets were inspected. Empty fixture tables are not evidence of zero production cost. Rates below are ASSUMED Phase 3 envelopes at 1,000 DAU; unquantified domains remain UNVERIFIED. Monthly means 30 days.

| Dataset | Synthetic/known consumption | Daily / monthly / annual growth | Retention | Read / write frequency and opportunity |
|---|---|---|---|---|
| Editorial articles | R2 fixture documents; actual editorial-only prior benchmark retained | Editorial/source/FTS combined 321.21 MB D1 at 365d; separate rates unverified | IDs, revisions, corrections, source attribution retained | Read-heavy; previous published-response cache retained; application gzip does not automatically compress legacy editorial bodies |
| Source ingestion | Prior benchmark; full source population unverified | Included in editorial envelope; split unverified | Preserve evidence, rights and source history | Scheduled; eliminate unchanged admissions before persistence; source rights still gate expansion |
| NFL news | Shares editorial data, not a second counted population | Separate daily/monthly/annual rate unverified | Saved links/history retained | Public caching; do not duplicate per-team content |
| AI summaries/search | Derived index plus immutable outputs | 200 keys/day; 6,000/month; 73,000/year before cleanup | Expired derived keys removable; underlying bodies retained | Shared requests; cleanup capped at 1,000 keys/tick after 30 days beyond expiry; CPU/provider calibration pending |
| Search indexes | FTS pages included in table audit | Full-product index growth unverified | Reconstructable index, durable documents retained | Indexed lexical reads; no semantic-answer parity claim |
| User accounts | 3,000 synthetic users, credentials, preferences, sessions | Initial 10 accounts/DAU × conservative 10,240 bytes; 102.40 MB at 1,000 DAU | Durable, no cleanup | Owner PK reads; accounts are not expired data |
| Front Office | 101 synthetic owners, 401 versions | 25 commands/day; 750/month; 9,125/year; 100 KB ordinary / 2.1 MB stress shape | All progress and versions retained | D1 head/CAS + R2 shared subtrees; actual Front Office route transactions still PostgreSQL |
| Trivia/Move the Chains | Daily route/concurrency/import tests; scale table population absent | Planning 0.512 MB/day / 15.36 MB/month / 186.88 MB/year | Answers, points and reward events retained | Daily D1 answer/stats/award atomic batch; multiplayer/reward redemption unported |
| Saved content/bets | 3,000 synthetic saved bets | Planning 0.6144 MB/day / 18.432 MB/month / 224.256 MB/year | All owned IDs and metadata retained | Owner reads; 32 KB metadata offload threshold preserved to avoid multiplying reads for ordinary lists |
| Parlay Lab/odds | Provider mocks plus historical directory | 16 events × 3/7 refreshes/day; 100 KB/event assumed | All raw books, alt lines, links and timestamps retained | Exactly three weekly refresh windows; dictionary/subtree history; board/Lab Score ports incomplete |
| Backup snapshots | {scale['checkpoint']['objects']:,} objects; {scale['checkpoint']['rows']:,} rows | Depends on changed chunks; zero writes measured for identical repeat only | No blind checkpoint or body pruning | Full frozen inventory verification; expensive reads remain; retention contract still needed |
| Logs | Only local evidence files measured | Production rate unverified | Avoid request bodies/tokens; durable audit retained | Request metrics filtered; no production log-storage estimate invented |
| Temporary processing | Consumed/expired token and AI tests | Actual production rate unverified | Token rows archived exactly before removal; live capabilities excluded | Daily optional bounded maintenance; defaults disabled |

Exact fixture pages by every table/index/column are in `reports/zero-cost-phase-4/scale-recovery.json` under `d1Pages`. Total synthetic D1 is {scale['d1Pages']['sqliteBytes']:,} bytes. This cannot substitute for production population measurements.

## Projections, including backup overhead

{horizons}

D1 after assumes the implemented derived-key maintenance is enabled and keeps pace; it is disabled in shipped local config. Without that assumption, retain Phase 3's approximately 936 MB. Compression factors 0.25 game, 0.50 odds and 0.25 backup-directory/D1-page bytes are ASSUMED, deliberately less optimistic than the ordinary fixture. Unported domain bytes remain null.

Phase 3's 15.3 GB R2 forecast assumed eight directory generations without implemented pruning. The comparable eight-directory counterfactual is {one['r2BytesCounterfactualEightDirectories']/1e9:.2f} GB; **it is not an active retention policy or a readiness result**. Retaining every daily checkpoint and crediting no reuse for changed chunks gives the conservative {one['r2BytesConservativeAllCheckpoints']/1e9:.2f} GB bound. An identical repeat reuses everything, but that does not prove daily changed-state reuse. The higher bound is a corrected retention assumption, not measured storage regression.

The 350 MB D1 / 7 GB R2 targets are not qualified. The minimum sustainable whole-product footprint is not established while domain volumes and retention guarantees are unknown. The implemented workload envelope still exceeds D1 targets without deleting valuable history. Avoid declaring current indexed history unavoidable in principle: further compact layouts/verified archival may reduce it, but are not implemented here.
''')
write('PHASE_4_D1_INTEGRATION.md',f'''# Phase 4 D1 application integration

{common}

**PARTIAL. The entire application cannot yet operate on D1.** Authentication/session/profile/preferences/saved-content adapters from Phase 3 remain. New actual daily-trivia handlers dispatch through a D1 repository; the original PostgreSQL repository is retained separately. Daily answer, stats, yards, unlock and notification records commit in one D1 batch with uniqueness and account-version guards. Concurrent duplicates award once. Truth and timing are read from trusted storage, not caller assertions. Owned reads, FK constraints, failure rollback, expired sessions and credential handling retain their tested behavior. Additive settings CAS and timestamp-indexed odds history are available; application settings consumers are not globally migrated.

Typed import now includes questions, daily assignments/views/answers, stats, Move the Chains accounts/events, reward definitions and unlocks. Non-daily/null-answer rows retain exact raw archives; they are not claimed executable. The representative daily/reward import preserves ten original source rows and relationships. The full 50-table synthetic PostgreSQL rehearsal archives {imported['archivedRows']} populated rows and imports {imported['typedRows']} typed rows; source remains unchanged. Original row text retains unported fields/precision. Imports intentionally require a fresh unserved target after failure, preserving the failed binding; this is not an in-place resumable importer.

| Domain | D1 status | Remaining PostgreSQL dependency |
|---|---|---|
| Auth/sessions/profiles/preferences/saved content | Existing staged adapters tested | Worker password hashing unavailable; mail transaction/cutover gaps |
| Daily trivia | Integrated actual GET/POST, atomic stats/yard award | Multiplayer/group games, social rooms, rematches and pools remain PostgreSQL |
| Move the Chains | Atomic award/account/event/unlock path | Rewards dashboard, crew ranking, claim/redemption/commerce and notifications UI remain PostgreSQL |
| Front Office | Shared immutable aggregate substrate and full PostgreSQL regression | Durable route transactions, events, offers, reconstruction and legacy recovery still PostgreSQL |
| Parlay Lab | Scheduler history uses shared tree format; old raw envelopes readable | Board IDs/mappings, Lab Score, Trending Props, grading and transfer queues unported |
| Editorial/search | Prior lean metadata/lexical adapters retained | Full original editorial application operations not all ported |
| Application settings | New bounded D1 CAS class tested | Full consumers/imports remain incomplete |
| Other domains | Existing Phase 3 inventory retained | Huddle, crew, game-day, commerce, notifications, video and additional SQL paths remain |

The Phase 3 115 historical declarations/877 SQL-site inventory is the starting dependency evidence, not repeated as a new broad audit. Concrete dispatch changes are limited to daily trivia and the standalone award path. No generic PostgreSQL-to-SQLite textual emulation or fake transaction wrapper was introduced. Selecting D1 globally still fails closed on unported paths. Whole-product migration, stateful multi-route parity and disabling old polling remain production blockers. Verified PostgreSQL compute eliminated: 0.
''')
write('PHASE_4_CLOUDFLARE_COMPATIBILITY.md',f'''# Phase 4 Cloudflare compatibility

{common}

Next 14.2.35 / OpenNext 1.8.3 moved to pinned Next 15.5.28 / OpenNext 1.20.12. Dependencies were installed in a separate copied dependency tree; Phase 3 dependencies remain intact. Dynamic App Router params/searchParams now await promises; the client story route uses `useParams`. Existing URLs, layouts, SEO metadata and React Native renderers are preserved. Native screens were not replaced or modified.

Node rollback build and actual local Worker boot execute. OpenNext's supported Node runtime uses `nodejs_compat` without the former process-v2 disabling workaround. Cloudflare Static Assets handles static files. Local-only fake IDs, remote=false, workers_dev=false and cleared credentials remain. Password auth retains original-strength Node Argon2; the Worker explicitly returns unavailable instead of weakening hashes. Filesystem/Node-dependent business functions are still unqualified or fail closed in D1 mode.

Final minified dry-run Worker size: **{size} KiB gzip**, above the Free **3 MiB** limit. A local dry-run is not account entitlement or deployability proof. The supported framework resolves the old legacy-adapter compatibility gap but does not resolve Free artifact size, startup/memory, password auth or unported APIs.

{len(probe['results'])} local SSR/API cold/warm probes retain exact statuses in `local-worker-probe.json`. Existing sessions and saved IDs work. Trending Props and editorial admission intentionally return 503. Separate actual workerd tests execute bounded compression/decompression. Local wall time and successful SSR are not billed CPU qualification. No preview or production deployment occurred. Browser checks exercise mobile-web at 390 px and desktop at 1440 px, KC/SEA; Android/iOS devices are unverified.

Sources checked 2026-10-18: [OpenNext support](https://opennext.js.org/cloudflare), [Next support policy](https://nextjs.org/support-policy), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). No claim that all Next features or all application dependencies have been qualified from a build alone.
''')
write('PHASE_4_PERFORMANCE.md',f'''# Phase 4 performance

Request-scoped D1 metadata instrumentation and R2 counters remain. The final probe records local cold/warm wall time, statuses and null Worker CPU. Compression executes in actual local workerd. Worker Free 10 ms CPU, startup and memory remain UNVERIFIED; no production trace is available or requested.

Implemented: shared immutable subtrees, gzip, duplicate checkpoint elimination, compressed/reused directory chunks, bounded maintenance, primary-key settings CAS and cursor-style odds paging. D1's existing batched commit/row guards remain. An opt-in 30-second public cache is restricted to credential-free `/api/parlay-lab/events` without query strings; private/no-store, Set-Cookie, errors and Vary:* are excluded. It is disabled by default and is not credited in capacity projections. Existing public editorial response caching remains. Precomputed Lab Score/Trending Props and complete board caching are unfinished.

Ordinary game history measured {scale['gameHistory']['r2Reads']:,} object reads / {scale['gameHistory']['r2Writes']:,} writes across 400 commits, including verification; {scale['gameHistory']['r2Reads']/400:.1f} reads/commit. This is not a latency or CPU win claim. Storage sharing can amplify reads; the model charges additional operations. All prior operation counts are retained as lower bounds, with no credit for unported workload reductions.

Scale D1 seed/commands metadata: {json.dumps(scale['d1Metrics'])}. This excludes the separately instrumented cumulative backup/restore SQL and object counters in the recovery report. Internal R2 calls and external fetch limits differ; no 50-external-fetch claim is incorrectly applied to internal R2. Daily backup is an offline multi-invocation tooling problem, not a single qualified Free scheduled Worker job.

{capacity}

Production CPU, actual cache hit ratio, concurrent peak traffic, fanout, source ingestion volume and complete business-path amplification remain unverified. The workload already misses D1-write and R2-read headroom. Extra databases do not multiply account-wide daily quotas.
''')
write('PHASE_4_PARLAY_LAB_OPTIMIZATION.md',f'''# Phase 4 Parlay Lab storage and processing

Three weekly windows remain **Monday/Wednesday/Saturday 15:00 UTC**, cron `0 15 * * 1,3,6`. Provider/scheduler flags remain false; no live sports call occurred. The provider quota is reserved durably before execution; uncertain requests are not blindly retried.

Scheduled publication now stores exact raw provider events through shared JSON-tree history, gzip and a compact indexed event/timestamp directory. Unchanged books/markets can share immutable leaves across snapshots. The manifest is schema 2 with explicit ODDS_TREE references; the reader retains schema-1 raw event compatibility. Event identity and history hashes are checked. Timestamp paging is bounded at 50. Different payloads for the same provider event/timestamp fail closed. Original event IDs, alt lines, bookmaker availability, deeplinks and all raw fields survive; no delta loses reconstruction dependencies. Historical responses explicitly identify `live:false` and preserve as-of time. Raw and compact event payloads are not both persisted as new full snapshots.

Existing provider contract, partial-coverage, failed-refresh, lost-ack, freshness and schedule tests pass. No refresh frequency increase or invented live labels. Lab Score calculations, complete player-prop indexes, Trending Props, persisted local market-ID mapping, saved-slip reconstruction against migrated IDs, grading and sportsbook transfer queues remain unported. The existing PostgreSQL implementations are retained. Stored raw bytes are sufficient inputs, not proof that those features now run on D1.
''')
write('PHASE_4_RECOVERY_SCALE_TEST.md',f'''# Phase 4 recovery scale rehearsal

**MEASURED synthetic local workerd, not production RPO/RTO.** {scale['users']:,} users, {scale['savedBets']:,} saved bets, 101 game owners, {scale['gameVersions']} versions, credentials/preferences/sessions, synthetic editorial/odds bodies, a high-entropy 2.1 MB game document, {scale['checkpoint']['tables']} logical tables, {scale['checkpoint']['rows']:,} rows and {scale['checkpoint']['objects']:,} R2 objects. User IDs, saved IDs, row hashes, object hashes and foreign keys survive exact restore.

Full backup: {scale['checkpoint']['milliseconds']/1000:.2f} s. Interrupted restore resumed to READY: {scale['restore']['milliseconds']/1000:.2f} s for the resumed call, not total interrupted+resumed wall time. Repeated idempotent restore: {scale['idempotentRestore']['milliseconds']/1000:.2f} s. Identical checkpoint: {scale['repeatedCheckpoint']['milliseconds']/1000:.2f} s, same ID, zero additional directory/body writes. These values include local I/O and verification, not production CPU.

Injected partial body-backup failure publishes no completed checkpoint; retry succeeds. Interrupted restore keeps target unserved; repeat resumes via chunk receipts. Exact final table and object verification and FK checks gate READY. Existing corruption, missing-object and wrong-key tests remain. JSON-tree edges are verified before checkpoint publication, not merely top-level pointers. Raw physical compressed bodies are copied and logical identities validated. Original uncompressed and encrypted Phase 3 checkpoints remain readable.

R2 operation totals across failure, successful checkpoint, duplicate checkpoint, interruption, resumed and repeated restore: `{json.dumps(scale['r2'])}`. These are cumulative totals, **not per-backup billing**. D1 logical fixture storage {scale['d1Pages']['sqliteBytes']:,} bytes; page/index/column attribution is retained in JSON. D1 seed metrics are not presented as recovery-operation counts. Cumulative backup D1 operations: `{json.dumps(scale['backupD1Metrics'])}`. Cumulative restore D1 operations: `{json.dumps(scale['restoreD1Metrics'])}`. They include failure/repeat calls rather than representing one clean invocation. Row counts and bounded 40-row restore batches are verified.

Limits retained: explicitly stopped writers, new unserved schema-matched target, 64 MB in-memory table ceiling, 900 KB row chunks, bounded object sizes and local tooling outside one production request. This is materially larger than Phase 3's 132-row rehearsal but is not an annual whole-product population. Streaming/online export, production-scale peak load, off-account encryption/key recovery, automated cutover gates and reference-safe retention remain blockers. No active backup pruning discards required rollback history.
''')
write('PHASE_4_PROVIDER_VALIDATION.md','''# Phase 4 provider integration validation

Only local contracts/mocks were executed. No credentials were read from production or local .env files; no live sending, inference, sports request, partner transfer, paid activation or deployment occurred.

| Integration | Local evidence | Exact remaining external step |
|---|---|---|
| Workers AI | Shared cache, source versioning, durable lease/neuron reservation, JSON/citation validation and explicit configured-provider failure tests | With separately approved synthetic resources, invoke the configured model; score citation/summary quality and compare actual neurons/CPU with estimates |
| Resend | Encrypted deduped queue, reserved quotas, opt-out/preferences, reset/verification routes, redirect rejection, lost-ack state and mock provider contracts | Verify sender/domain and account entitlement; deliver a synthetic message to an owner-controlled mailbox; verify unsubscribe/consent/webhook behavior. Broadcasts consent/contact synchronization still not implemented |
| SportsGameOdds | Real client exercised with mocked usage/events; includes all selected books and alt lines, partial coverage, quota reservation, empty/error cases and three-weekly scheduling | Verify account object budget, NFL coverage, rights and returned metadata against one approved bounded synthetic/staging request; reconcile usage before/after |
| Unabated/Gambly | Existing provider/transfer contracts plus synthetic PostgreSQL transfer DB tests retained | Obtain approved sandbox entitlement and complete a sandbox sportsbook transfer/callback. Full D1 queue/id mapping remains unfinished |
| Authentication | Node original-strength Argon2, D1 session/token/ownership/isolation tests; Worker existing-session probes and password-unavailable assertion | Qualify a secure supported Worker hashing strategy within real CPU/memory; test real OAuth redirects only after explicit approval |
| Scheduled jobs | Durable slots, exactly three weekly odds windows, disabled flags and local dry-run; optional maintenance reuses existing mail tick | After code/capacity approval, run synthetic cloud scheduling/duplicate-delivery traces. No live cron is activated here |

Current public allowances are not account entitlement proof. [Resend pricing](https://resend.com/pricing), [SportsGameOdds pricing](https://sportsgameodds.com/pricing), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). Email remains 60 editorial/day plus ten reserved transactional attempts; this does not serve 1,000 daily subscribers. Existing behavior remains available through PostgreSQL; mocked payloads are never described as live validation.
''')
write('ZERO_COST_PRODUCTION_READINESS_PHASE_4.md',f'''# Down & Distance — Zero-Cost Production Readiness, Phase 4

## 1. Executive summary

**Production readiness: BLOCKED. Phase 4 is partially implemented; whole-product D1 completion and $0 at 1,000 DAU are not achieved.** Storage safety, recovery scale, daily trivia/rewards, compact odds history and supported framework compatibility have concrete implementations. No production-readiness claim follows from passing local tests.

{common}

## 2. Architecture changes

One staged D1 + private R2 remains the simplest local candidate. PostgreSQL remains authoritative/default with rollback retained. Additive migrations 0016–0018 add bounded lifecycle indexes, history/settings, daily trivia/reward relationships and odds history. Original IDs/raw imports remain. SHA-addressed gzip objects and shared trees preserve old reads. Maintenance/cache/provider flags remain disabled. No user/game/editorial body garbage collector is enabled.

## 3. Storage optimization results

Game fixture full logical snapshots {scale['gameHistory']['legacyLogicalBytes']:,} bytes → {scale['gameHistory']['physicalPrimaryBytes']:,} primary physical bytes ({scale['gameHistory']['ratio']:.2%}). All versions remain. This does not justify applying that ratio to every dataset. D1 forecast remains about {one['d1Bytes']/1e6:.2f} MB with derived-key maintenance, above target. Backup compression and unchanged-checkpoint reuse work, but changed-data retention/reuse remain unqualified. See PHASE_4_STORAGE_OPTIMIZATION.md for every requested dataset and exact page evidence.

## 4. D1 integration status

Daily trivia GET/POST now operate against D1, preserving point values and atomic answer/stats/yard/unlock behavior. Standalone Move the Chains awards use D1 with idempotency and version guards. New typed imports preserve original daily/reward IDs and foreign keys. Settings CAS and compact odds history are implemented. Full multiplayer trivia, reward dashboard/claim/redemption, Front Office and Parlay application paths remain incomplete. See PHASE_4_D1_INTEGRATION.md.

## 5. PostgreSQL dependency status

Default connections were not changed. The original trivia repository is retained. Full PostgreSQL Front Office/auth/transfer/trade regression tests execute. The 50-table synthetic import archives {imported['archivedRows']} rows and maps {imported['typedRows']} typed rows, with exact raw records for unported data. It is not full application migration. Existing polling is not disabled; verified PostgreSQL compute removed: 0. Full migration replay still stops at unavailable local pgvector, documented in full-postgres-migrations.json.

## 6. Cloudflare runtime compatibility

Pinned Next 15.5.28/OpenNext 1.20.12 builds and boots under actual local workerd with Node compatibility. Promise-based route parameters preserve existing URLs. Existing-session, saved-content, SSR and lexical-search probes run; unavailable endpoints remain explicit. Minified artifact **{size} KiB gzip exceeds Workers Free's 3 MiB**. Worker password auth remains unavailable; Node rollback retains original Argon2 strength. Compatibility improved; Free hosting is not qualified.

## 7. Worker performance results

Local wall timings and D1/R2 metadata are recorded; production CPU remains **UNVERIFIED**. Public cache and batching/indices/paging are implemented, with cache disabled and no speculative hit-rate credit. Game sharing adds object operations; the model includes them. Backup/restore is offline multi-batch tooling, not a qualified single Free Worker invocation. See PHASE_4_PERFORMANCE.md.

## 8. Parlay Lab optimization

The same three weekly odds windows remain disabled. New history uses shared compressed subtrees, compact timestamp indexes and explicit schema-2 references, retaining legacy raw reads. All provider fields/books/alt lines/as-of values remain. Board IDs, Lab Score/Trending Props precompute, grading and complete transfer integration remain PostgreSQL. Historical data is not represented as live.

## 9. Recovery scale testing

{scale['users']:,} users, {scale['savedBets']:,} saved bets, {scale['gameVersions']} game versions, {scale['checkpoint']['tables']} tables, {scale['checkpoint']['rows']:,} rows and {scale['checkpoint']['objects']:,} objects survive failure/interruption/idempotent recovery. Full local backup {scale['checkpoint']['milliseconds']/1000:.2f} s; resumed restore {scale['restore']['milliseconds']/1000:.2f} s. Duplicate checkpoint has identical ID and zero new writes. Off-account, streaming/annual population and cutover qualification remain incomplete. See PHASE_4_RECOVERY_SCALE_TEST.md.

## 10. Provider integration status

Mock/contract behavior and disabled scheduler dry-runs pass. No real AI/email/sports/partner execution occurred. Exact external validation steps are documented in PHASE_4_PROVIDER_VALIDATION.md. Credential-free local validation cannot certify provider rights, account allowance, delivery or inference quality.

## 11. Test results

{validation}

Total successful suite checks: **{passed:,}**, failures: **{sum(v['fail']for v in suites.values())}**. Browser: {len(browser['routes'])} route/viewport cases, no errors/overflow. Two standalone conditional skips execute and pass in dedicated sportsbook/trade integrations; no tests were removed. New Worker runtime tests exercise actual workerd compression; D1 API tests separately exercise daily trivia and ownership. Original 53 archival tests remain within the complete D1 suite. Typechecks and Node/Worker builds are retained separately. Native devices/simulators remain unverified; rendering adapters were not redesigned.

## 12. Updated storage projections

{horizons}

Numbers are **PROJECTED**, using retained Phase 3 workload assumptions and explicitly stated codec factors. Phase 3 before: 935.75 MB D1 / 15.27 GB R2 with an assumed eight directories. The eight-directory Phase 4 scenario is {one['r2BytesCounterfactualEightDirectories']/1e9:.2f} GB, but no active eight-generation pruning exists. Conservative all-daily-checkpoint retention yields {one['r2BytesConservativeAllCheckpoints']/1e9:.2f} GB; this corrects the previous retention omission rather than claiming measured R2 growth. No changed-checkpoint sharing reduction is credited. Unknown domain volumes stay null. A minimum sustainable whole-product footprint is not established.

## 13. Updated $0 capacity

{capacity}

**Verified maximum sustainable whole-product DAU at $0: NOT ESTABLISHED.** The bundle is a traffic-independent Free blocker. The 1,000-DAU scenario also exceeds D1 database/storage targets, write headroom, R2 storage/read allowances and implemented editorial mail capacity. Production CPU and unported domain workload could constrain it further. Local incremental spend $0; production monthly cost UNVERIFIED, no paid fallback activated.

Public account-wide budgets checked 2026-10-18: D1 5M rows read/day, 100k written/day, 5 GB/account, 500 MB/database; Workers 100k requests/day, 10 ms CPU/invocation and 3 MiB compressed artifact; R2 Standard 10 GB, 1M Class A and 10M Class B/month; Workers AI 10k neurons/day. Apply 30% operational headroom and subtract other account usage. More D1 databases do not multiply daily quotas. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## 14. Remaining production blockers — Phase 3 vs Phase 4

| Blocker | Phase 3 | Phase 4 / evidence | Remaining work |
|---|---|---|---|
| Storage/operations | 936 MB D1, 15.3 GB R2 subtotal | PARTIAL: gzip/tree/directory reuse, exact fixture pages and conservative corrected model | Compact retained transactional directories, safe changed-checkpoint retention and full workload counts; meet write/read budgets |
| D1 application | Account subset staged | PARTIAL: actual daily trivia/yard award APIs, typed migration and compact scheduler history | Full Front Office, multiplayer trivia, reward UI/claims, Parlay IDs/board/Lab Score and remaining domains |
| Framework | Next 14/legacy adapter | PARTIAL: supported Next 15/OpenNext, actual local runtime probes | Reduce/split supported artifact without removing functionality; qualify startup/memory and secure password hashing |
| Worker CPU | Unverified | UNVERIFIED: local timings/counters only | Explicitly approved cloud synthetic CPU traces; no deployment authorized here |
| Providers | Mocks/staged services | UNVERIFIED live; local contracts retained | Approved sandbox inference/delivery/rights/partner checks and account entitlement |
| Recovery scale | 61 tables/132 rows/4 objects | PARTIAL: {scale['checkpoint']['tables']} tables/{scale['checkpoint']['rows']:,} rows/{scale['checkpoint']['objects']:,} objects, faults and resume | Streaming full-year load, off-account keys, cutover/read gate and retention execution |
| Native validation | JS builds only | UNVERIFIED devices; no renderer redesign | Device deep links, provider actions, error states and push before integration |

## 15. Recommended next phase

Review this isolated commit. Do not cut over or deploy. The smallest demonstrated path is to finish one stateful business vertical at a time with real route/transaction parity, compact old indexed history without losing lookup/replay, define the required backup rollback window before reference-safe pruning, and reduce the supported Worker artifact below Free size. Qualify secure Worker auth and approved synthetic CPU/provider traces only after those local gaps close. A second D1 alone cannot fix account-wide writes, R2 reads, email demand or artifact size. No architecture currently earns a 1,000-DAU $0 readiness claim. Stop for review.
''')
print(json.dumps({'suitePasses':passed,'reports':8,'productionReadiness':'BLOCKED','workerGzipKiB':float(size)}))
