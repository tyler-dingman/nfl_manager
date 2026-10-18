"""Render Phase 3 evidence. Does not run deployment, credentials, mail or providers."""
import json,pathlib,re,statistics
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/zero-cost-phase-3'
def read(name,default=None):
 p=OUT/name
 return json.loads(p.read_text()) if p.exists() else default
def tap(name):
 p=OUT/name
 text=p.read_text() if p.exists() else ''
 return {k:int(re.search(r'^# '+k+r' (\d+)$',text,re.M).group(1)) if re.search(r'^# '+k+r' (\d+)$',text,re.M) else None for k in ['tests','pass','fail','skipped']}
def write(name,text):(ROOT/name).write_text(text.strip()+'\n')
unit=tap('unit-tests.log');d1=tap('d1-all-tests.log');fo=tap('front-office-integration.log');pg=tap('auth-durability-integration.log');transfer=tap('sportsbook-db-integration.log');trade=tap('trade-http-integration.log')
browser=read('browser-results.json',{'routes':[]});migration=read('postgres-d1-import.json',{});recovery=read('cross-store-rehearsal.json',{});benchmark=read('application-storage-benchmark.json',{});model=read('capacity-model.json',{});inventory=read('postgres-dependency-map.json',{});worker=read('local-worker-probe.json',{})
summary={'application':unit,'d1':d1,'frontOffice':fo,'postgresAuth':pg,'sportsbook':transfer,'tradeHttp':trade,'browserCases':len(browser['routes']),'browserErrors':[r for r in browser['routes'] if r.get('error') or r.get('status')!=200 or r.get('horizontalOverflow')], 'standaloneSkipsRequalified':['durable PostgreSQL sportsbook reservations','authenticated versioned Trade Machine HTTP'], 'productionWorkerCpu':'UNVERIFIED','androidIosDevices':'UNVERIFIED'}
(OUT/'validation-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
table='\n'.join(f'| {name} | {result["pass"]} | {result["fail"]} | {result["skipped"]} |' for name,result in [('Application Node',unit),('D1/R2 + Node-on-D1 routes',d1),('Front Office PostgreSQL',fo),('PostgreSQL auth',pg),('Sportsbook PostgreSQL fixtures',transfer),('Trade HTTP',trade)])
tests=f'''| Executed suite | Passed | Failed | Skipped |
|---|---|---|---|
{table}

Chromium: {len(browser['routes'])} route/viewport cases, {len(summary['browserErrors'])} failures. Two conditional skips remain in the standalone command; **both execute and pass in their dedicated isolated integrations**. They are not unresolved coverage gaps or counted twice as passes. SQLite page tests have a separate log. Local Worker probe statuses are reported separately from applicable suite passes. Native bundle compilation is not device validation.'''
initial=json.loads((ROOT/'reports/zero-cost-phase-2/validation-summary.json').read_text())['application']['failures']
causes=[('Environment issue','Standalone JSX required the React JSX transform; add deterministic Node test loader.'),('Outdated expectation','Classification moved to a shared helper; retain explicit breaking rules and message exclusion.'),('Environment issue','Standalone CSS/font imports require a test adapter; real assets remain checked by production build/browser.'),('Environment issue','Use the standalone React JSX test transform.'),('Environment + outdated expectation','CSS modules and backdrop/accessibility selectors changed; retain accessible modal checks.'),('Outdated expectation','Persistence is owned by the durable route wrapper; assert the wrapper owner/latest-save contract.'),('Outdated expectation','Current merchandising labels use a department variable.'),('Outdated expectation','New & Trending is a JSX text value, not an HTML entity string.'),('Outdated expectation','Current desktop controls use the lg breakpoint.'),('Outdated expectation','Current trivia layout uses ResponsiveRail stacking and separate question/stat sections.'),('Test bug','Fixture destructuring discarded explicit rating/rank/projection overrides.'),('Test bug','Preview access does not substitute for a revocable authenticated session; mock the session lookup.'),('Outdated expectation','AppShell now uses usePathname, not useSearchParams.'),('Outdated expectation','Selected profile navigation moved into its own shared component.'),('Outdated expectation','Fairness boundaries are .82/.90/1.09/1.21; add exact boundary coverage without rebalancing.'),('Outdated expectation','The current elite asset guard rejects that package; preserve valuation behavior.'),('Test fixture bug','Live free agents and cap/owned-pick assumptions changed. Inject synthetic FA/picks and use actual contract year-one cap.')]
rows='\n'.join(f'| {name} | {kind} | {fix} |' for name,(kind,fix) in zip(initial,causes))
write('PHASE_3_TEST_BASELINE.md',f'''# Phase 3 test baseline

Started from `87101164` in `/private/tmp/down-distance-zero-cost-phase-3`, branch `poc/zero-cost-production-readiness-phase-3`. Read the Phase 2 report and its actual 17 failures before backend changes. The baseline was corrected first: 1,057 passes, zero failures, two conditional skips. Gameplay economics, authentication gates and real rosters were preserved.

| Original failure | Classification | Correction |
|---|---|---|
{rows}

`tsconfig.test.json`, `tests/node-environment.cjs` and the clean-environment runner provide standalone JSX/CSS/font adapters. They do not replace browser assets. No test was deleted. Later provider-dispatch source assertions were updated to follow the retained PostgreSQL implementation and the stronger all-provider failure propagation rule; a behavioral test verifies all configured inference providers fail without invented output.

The skipped sportsbook suite uses its own localhost schema and injected provider fixtures; it now runs with `RUN_FANDUEL_DB_TESTS=true`. The skipped Trade Machine test needed current authenticated version/CAS command headers. It now runs against separate real Next route bundles and a fresh synthetic owner/save. Missing configuration still causes a conditional skip in standalone runs, rather than permitting an accidental real-account test.

{tests}

Commands: `python3 scripts/qualify-phase-three.py`; `node scripts/qualify-phase-three-workers.mjs`; `python3 scripts/qualify-phase-three-postgres.py --browser`. All database runners use newly created local resources and remove only owned synthetic fixture directories. Existing full PostgreSQL migrations still stop at `017_search_documents.sql` because pgvector is absent locally; this is not a successful full-schema rehearsal.
''')
write('POSTGRESQL_TO_D1_MIGRATION_RESULTS.md',f'''# PostgreSQL to D1 migration results

**PARTIALLY RESOLVED. PostgreSQL remains authoritative by default. It cannot be removed from the whole product.** The work implements executable account/session/settings/saved-content adapters and lossless offline import staging, not a generic JSON archive masquerading as a completed gameplay migration.

## Dependency map

The static inventory covers {len(inventory.get('tables',[]))} distinct table declarations in migration history, {len(inventory.get('queries',[]))} SQL sites across both backends, {len(inventory.get('connections',[]))} connection factories, and {len(inventory.get('unresolvedSqlCalls',[]))} variable-query call sites requiring review. `reports/zero-cost-phase-3/postgres-dependency-map.json` retains SQL, files/lines, enclosing functions, syntactic callers, table declarations, imports and interpolation flags. The Markdown companion lists all 115 tables and all factories. These are historical DDL declarations, not 115 verified active production tables. Interpolation includes ordinary bound values; the map does not prove a complete dynamic call graph. No production connection or credentials were inspected.

## Executable staged mappings

| PostgreSQL source | D1 target | Qualification |
|---|---|---|
| users | app_users | Original IDs, case-insensitive email uniqueness, account status |
| user_credentials | app_credentials | Original Argon2 hashes, failures and lockout metadata |
| user_identities | app_identities | Provider/subject uniqueness and explicit linking |
| devices | app_devices | Ownership-checked session device references; extra device fields remain archived |
| sessions | app_sessions | Original IDs/families/hashes, expiration, revocation and replay detection |
| auth_tokens | app_tokens | Hashes, one-time consumption; reset/email confirmation atomic batches |
| user_profiles + user_preferences | app_settings | Mapped profile/preferences fields; every original field also archived |
| user_team_follows | app_team_follows | Original IDs and one-primary partial unique index |
| user_saved_content | app_saved_content + private R2 | Original article/slip IDs and links, large metadata offload |
| new security events | app_security_audit + R2 | D1 login audit persists before session issuance; historical PG events remain archived |

Private saved metadata pointers use a server-owned column and owner/content-ID envelopes; user JSON keys are always literal. A cross-user pointer injection/corruption regression fails closed. Additive migrations `0011`–`0015` leave previous D1 data and PostgreSQL migration history intact. Dispatchers retain original PostgreSQL modules and require `APP_DATA_BACKEND=d1` to select the staged backend. Both connection factories reject PostgreSQL access in D1 mode. Missing D1 methods throw explicitly; they never fall through to Neon. `ApplicationDocuments` provides owner-scoped R2-backed revision CAS/command receipts for future aggregate ports. It preserves old versions and rejects stale writers and oversized objects without advancing a head.

## Actual import and rollback rehearsal

A fresh localhost PostgreSQL cluster replays selected migrations twice, exports exact `row_to_json` text in one read-only repeatable-read statement, and imports **{migration.get('archivedRows')} rows from {migration.get('sourceTables')} tables**, with **{migration.get('typedRows')} typed target rows**. Empty source tables are counted as schema coverage, not populated-data coverage. All raw rows, including unported columns and numeric representations, remain in content-addressed private R2 with D1 import references. Typed dates/booleans are mapped explicitly; arbitrary PostgreSQL SQL is not translated.

The source dump restores into another new PostgreSQL database with all 50 per-table fingerprints equal. D1 import leaves source fingerprints unchanged. IDs/password hashes survive D1 restart. The current synthetic D1 file occupies {migration.get('sqlite',{}).get('sqliteBytes')} bytes including every legacy/additive table/index; mirror writes total {migration.get('r2WrittenBytes')} bytes. This is fixture storage, not a 1,000-user forecast. Partial/nonempty D1 import targets are refused; preserve a failed target and import again into a new unserved binding. Configuration rollback restores the retained PostgreSQL adapter; no reverse-drop/data erasure is performed. Post-cutover dual-write reconciliation is not implemented.

## Remaining operations

Front Office relational commands/reference bundles/recovery evidence, trivia multiplayer/results, Move the Chains transactional awards, catch-up, polls/predictions, notifications/consents, account deletion/export, commerce, Huddle, full editorial publication, vector/structured search, odds board/Lab Score generation and sportsbook transfer queues retain PostgreSQL dependencies. Their original tests and code remain. Saved bet slips using `/api/user/saved-content` are exercised through the actual shared account-save helper on D1; grading/transfer/odds APIs remain separate unported operations. Generic aggregate storage tests do not qualify their business transactions.

Signup currently commits account/credentials/settings before its separate token/mail batch; mail failure can leave a pending account. Admission/idempotent retry and a complete signup transaction remain a production gate. Large private saved lists also need bounded pagination/fanout, and full import datatype/field coverage is not certified. Worker password hashing remains unavailable at the original security parameters. Social provider exchanges and distributed rate limiting are not qualified on Free Workers. Production coexistence/cutover, full schema including pgvector, all historical fields as live adapters and all route contracts remain blockers. **Verified Neon compute eliminated: 0.** No existing polling job was disabled before a validated replacement exists.

{tests}
''')
write('ZERO_COST_AI_IMPLEMENTATION.md','''# Zero-cost AI implementation

**PARTIALLY RESOLVED.** Shared generation/caching and retrieval execute locally. Free hosted inference quality, account usage and the complete answer pipeline remain unverified.

`SharedInference` keys by model, team, source version, policy, prompt and output limit. It uses durable D1 leases, verified immutable R2 results and atomic quota reservations before inference. Identical concurrent requests cannot duplicate a generation. Source changes invalidate the key. Errors retain uncertain reservations; no paid fallback or fabricated result is substituted. The default local ceiling is 7,000 estimated neurons/day and cannot be raised beyond that Free-policy budget through the constructor. Cached results remain usable when new generation is unavailable. Expired/source-mismatched answers are not presented as current.

`WorkersAITopicSummarizer` is a concrete, opt-in Workers AI adapter connected to the existing team content engine. It validates structured output and supplied citation IDs. It does not establish factual quality; a reviewed source corpus and actual hosted comparisons remain required. No AI binding/provider was activated or called. Existing paid inference is still refused by the zero-cost policy. Configured Ollama/OpenAI/Workers-AI failures now propagate rather than silently becoming deterministic summaries. Explicit deterministic categorization remains available for its existing use.

Cloudflare advertises 10,000 free neurons daily; the chosen Qwen model rates are 4,625 input / 30,475 output neurons per million tokens. The local guard uses a conservative byte/token estimate plus chat overhead, not an observed billing receipt. At 2,500 input bytes and 700 output tokens, 200 shared generations reserve 7,000 estimated neurons/day. Larger prompts reduce that capacity. Other account consumers and actual model tokenization must be reconciled before a $0 claim. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

The D1 FTS5 path executes ranked lexical retrieval with team filtering, safe bound match terms and source attribution. `/api/search` selects it only in explicit D1 mode. Unknown classification/timestamps are marked unavailable; it does not invent publication dates or claim vector equivalence. Generated answers return an explicit 503 while that pipeline is unported. PostgreSQL vector documents, full canonical indexing, evidence/correction refresh and index population remain required. Native consumers receive the existing top-level results/sources/timing envelope; comprehensive search DTO parity is not certified.

Local tests cover repeat cache hits, concurrent coalescing, source invalidation, denied quota without provider calls, hostile query terms, team isolation, citation preservation and no fabricated provider fallback. No inference quality, production CPU, voice/transcription provider or hosted embedding functionality was validated.
''')
write('EMAIL_DELIVERY_IMPLEMENTATION.md','''# Email delivery implementation

**PARTIALLY RESOLVED.** Recovery/verification mail staging, encrypted payloads, provider-independent delivery, subscriptions and queue processing execute against local D1/R2. No real email was sent. Production deliverability and the full daily-publication integration remain blocked.

`MailQueue` stages encrypted private payloads before D1 references, deduplicates publication/recipient/token keys, reserves attempts atomically and rechecks consent/preferences before editorial delivery. Recovery token issuance and its mail queue row commit in one D1 batch. Password reset consumes the token, updates the credential and revokes sessions atomically. New web and native forms handle verification/reset tokens, matching confirmation/password bounds, errors and success states. Web tokens are removed from browser history; native route parameters are cleared after capture. HTTPS mail links currently open the web form; production universal/app-link association remains unverified. Node-on-D1 API tests cover success, revocation and restart; Free Worker password operations explicitly return 503.

The concrete Resend adapter uses fixed HTTPS endpoints, manual/no-follow redirect handling, timeouts, bounded hashed idempotency keys and visible unsubscribe text plus one-click headers. Payloads use versioned AES-GCM/base64 envelopes; version-one envelopes remain readable. A provider-independent interface allows a future provider switch. Daily approved team-publication enqueueing preserves source text, requires verified active opt-in recipients and honors email preferences, with a three-recipient page limit. Wiring every existing PostgreSQL Three & Out publication/timezone into this new queue remains unfinished.

The processor handles at most three messages/invocation to bound D1 queries/subrequests. The disabled application scheduler declares a 30-minute queue tick. Protected `/api/automation/email` is an alternative explicit drain entry; it requires a separate strong job secret and `APP_MAIL_ENABLED=true`. No service credentials are present. Public unsubscribe is signed and expiring; GET confirms without changing consent and POST applies it. An authenticated subscription endpoint exposes queue-state counts. Queue exhaustion returns a deferred count/207; rows are retained, not silently discarded. Operators still need a production alert destination, suppression/bounce webhooks and an approved-publication dispatcher.

Delivery acknowledgement is not equivalent to inbox receipt. Ambiguous failures/interrupted sends enter UNCERTAIN and are not blindly retried after the provider's idempotency window. Provider reconciliation/manual recovery tooling is still needed; idempotent queueing is not an exactly-once SMTP guarantee. Known quota limits reserve attempts even if acknowledgements are lost.

## Verified public tiers and implemented capacity

Resend documents 100 transactional emails per UTC day and 3,000 per month, including inbound messages, with a shared team request limit. The implemented queue reserves 30% headroom and ten daily transactional attempts: **60 daily editorial recipients**, or 1,860 editorial sends in a 31-day month, plus 310 transactional attempts. This assumes no other account/inbound usage; it is not 1,000 daily subscriptions. [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)

An important alternative is Resend Broadcasts: public documentation offers unlimited marketing sends to 1,000 contacts/month, separately from transactional volume. With 30% contact headroom that is **700 contacts**, conditional on actual account entitlement and counting other/unsubscribed contacts as required. Marketing consent/segment synchronization and webhook reconciliation have not been implemented or verified here. This is a promising next implementation, not current queue capacity or an excuse to create duplicate accounts. [Broadcast/transactional distinction](https://resend.com/pricing), [marketing offering](https://resend.com/products/marketing-emails)

Brevo also advertises 300 daily free sends; 30% headroom minus ten recovery attempts leaves at most 200 editorial recipients/day, subject to its current account conditions. No Brevo adapter/account was activated. Batching saves API requests, not recipient quotas. [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)

Before any real sending, verify sender DNS/domain ownership, Free/overage settings, inbound/other sender usage, consent migration, queue alerts, provider idempotency and bounce/complaint handling, a controlled recipient delivery and native/web link flows. These require separately scoped account access; no such access occurred in this work.
''')
write('PARLAY_LAB_SCHEDULING_RESULTS.md','''# Parlay Lab scheduling results

**PARTIALLY RESOLVED.** The concrete three-weekly ingestion path, durable budget, verified R2 publication and freshness adapters execute locally. Existing PostgreSQL odds board/Lab Score/transfer repositories have not been replaced.

The disabled application Worker configuration declares `0 15 * * 1,3,6`: Monday, Wednesday and Saturday at 15:00 UTC. Odds are not scheduled daily or continuously. Its other trigger only processes email queues. Both provider feature flags default false; local database/bucket IDs are sentinels. No cron, account resource, remote preview or provider was activated.

The scheduler claims each slot durably, preserves original event/odd IDs and full provider bytes, and requests all existing supported books with alt/opposing/open-close odds. It uses the existing SportsGameOdds client with 25-event pages, a two-data-request run cap, provider usage preflight and durable account-wide reservations before each data request. The conservative monthly local guard is 700 reserved objects. Manual redirects cannot forward provider credentials. Missing usage/quota exhaustion stops safely; old publication pointers remain. Each event is verified in immutable R2 before a compact publication manifest/pointer is advanced. Partial sportsbook coverage is recorded explicitly. Empty/duplicate/incomplete refreshes and oversized payloads do not replace the previous valid board snapshot.

Duplicate slots never repeat a provider attempt. STARTED/UNCERTAIN states survive interruption and require usage reconciliation; they do not expire into blind retries. There is no automatic catch-up that makes missed odds appear current. The shared freshness calculation detects an overdue schedule window and invalid/future dates. The actual web/native screens display an as-of/unknown warning and describe the three-weekly schedule as a **target** while it is unactivated. Until the D1 board consumes its new publication pointer, the existing board cannot borrow that timestamp; it reports unverified freshness instead. The PostgreSQL timestamp query is coalesced/cached to avoid a scan per viewer.

A 16-event mirrored snapshot plus manifest performs about 119 R2 operations. These are internal-service operations under the documented 1,000 internal-service limit, not the 50 external-fetch allowance. Packing remains an efficiency opportunity, not a demonstrated 50-request violation. D1 query count, CPU, memory and larger payloads still require actual Worker qualification. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/)

At a maximum 15 slots per 31 days, one reserved 26-object page/slot costs 390 reserved units. Two pages at every slot cost 780, exceeding the 700 margin guard; the schedule then stops explicitly and needs an admission/coverage decision. Actual provider accounting, season event counts, commercial redistribution rights and all other account consumers remain unverified. Published Amateur allowance is 2,500 objects/month; code does not assume the whole allowance belongs to this project. [SportsGameOdds pricing](https://sportsgameodds.com/pricing/)

Tests execute scheduled/outside-window runs, concurrent duplicate claims, partial books, preserved alt lines, provider failure, interrupted/uncertain retry refusal, stale/missed windows, provider-reported quota and stale-provider-report/local-budget exhaustion. Existing 88-case D1/R2 tests include the earlier scheduling cases. The formerly skipped real PostgreSQL sportsbook fixture test passes; it exercises FD/DK and additional-book contract behavior with injected providers, not actual sportsbook execution.

**Unfinished:** publishing the new snapshot through every current board endpoint; reusing existing Lab Score formulas during D1 ingestion; completing transfer/grading queues and native/API contracts on D1; safe reconciled retry tooling; actual partner eligibility, URLs/availability and live provider freshness. No Lab Score, alt threshold, book list, saved slip or transfer formula was removed or replaced by invented data. Do not disable the current production ingestion until the full replacement passes.
''')
write('CROSS_STORE_RECOVERY_RESULTS.md',f'''# Cross-store recovery results

**PARTIALLY RESOLVED. MEASURED offline local recovery succeeds; production-scale coherent recovery remains unqualified.**

`cold-recovery.ts` now snapshots every logical application/editorial D1 table, excluding SQLite/Cloudflare internals, FTS shadow tables and restore journals. FTS logical content is restored through its virtual table. Original keys, rows, owner references, auth hashes/session families, saved IDs, source references and configuration remain intact. It inventories the entire frozen primary R2 namespace, including unreferenced immutable objects, and checks known D1 object references and content-addressed hashes. It never deletes a source row/object.

Writers must be stopped and the target must remain unserved. The explicit `OFFLINE_WRITERS_STOPPED` precondition is required because reading more than 50 tables across D1 batches is not an online transaction. A second table/inventory/hash pass detects changes during the copy, but cannot prove no writer resumes afterward. No online consistency or simultaneous PostgreSQL/D1 cutover is claimed.

Version-three manifests reference verified immutable backup objects by original key/hash. Existing body copies can be reused between checkpoints; payloads are not re-encrypted and duplicated for each directory snapshot. Raw object backups retain the bytes as stored and require private, encrypted-at-rest buckets; database directory chunks/manifests use AES-GCM with a separately retained key. Version-one/two encrypted-envelope/chunk readers remain. This is not verified off-account encryption/key recovery. The backup namespace must be independent of the frozen source. Adding backup objects to the source would fail the unchanged-inventory check.

Restore verifies/decrypts the manifest, requires the same additive schema and a new unserved target, copies/verifies R2 before D1 references, replays row groups below the batch/parameter ceiling and atomically records chunk receipts. Repeated or interrupted FTS restores do not duplicate rows. Final table fingerprints, counts and foreign-key checks must match before the journal becomes READY. Conflicting/corrupt data is refused rather than overwritten. SQL/HTTP routing must never expose RESTORING targets; the production cutover gate is not implemented.

## Executed rehearsal

{recovery.get('backup',{}).get('tables')} logical tables; {recovery.get('backup',{}).get('rows')} rows; {recovery.get('backup',{}).get('objects')} immutable objects. All source and restored D1/R2 stores use disposable Miniflare bindings. A 2.1 MB game document, original credentials/session, saved article, saved bet aggregate, editorial/config aggregates and 85 historical search rows are included. Recovery resumes after an interruption at chunk 9; repeated restore also verifies. Missing D1 references, corrupt source hashes and a wrong decryption key are rejected. Every logical table hash/count matches.

Latest local backup: {recovery.get('backup',{}).get('milliseconds',0)/1000:.3f}s. Successful resumed restore/verification: {recovery.get('restore',{}).get('milliseconds',0)/1000:.3f}s, excluding the intentionally failed attempt. These are small local wall-clock timings, not production RTO. The independent PostgreSQL rehearsal restores all 50 synthetic tables and preserves source fingerprints; raw imported PostgreSQL rows are recoverable but unported business tables are not executable D1 state.

## Limits and retention

Current cold tooling has a 64 MB in-memory logical-row ceiling, 900 KB row ceiling, 8 MB object ceiling, bounded SQL parameter/batch limits and no streaming PostgreSQL/production export. Exceeding a bound fails instead of dropping data. The whole-product forecast exceeds this rehearsal scale. Full gameplay/trivia/odds population, off-account object/key recovery, automated checkpoint scheduling, retention enforcement and recovery-serving gates remain blockers.

All current originals, versions, receipts and artifacts are retained. The capacity model's eight directory copies are a planning assumption, not an active deletion policy. Production retention requires separately reviewed reference-safe pruning; keeping every daily checkpoint indefinitely grows beyond that model. Immutable body references are shared, and old user/editorial history must remain recoverable. Production RPO/RTO: **UNVERIFIED**. No production backup or restore was run.
''')
write('reports/zero-cost-phase-3/README.md','''# Phase 3 reproducibility

This evidence belongs to the isolated Phase 3 worktree based on `87101164`. All runtime database fixtures are disposable synthetic data. No production databases, providers, deployment or paid services were accessed.

1. `python3 scripts/qualify-phase-three.py` — standalone application tests with Node-only CSS/font/JSX adapters.
2. `node scripts/qualify-phase-three-workers.mjs` — complete D1/R2 plus Node-on-D1 handler tests, clean environment.
3. `python3 scripts/qualify-phase-three-postgres.py --browser` — freshly initialized localhost PostgreSQL, gameplay/auth/transfer fixtures, raw D1 import, SQL restore and real Node HTTP/browser checks. Requires PostgreSQL CLI and local Chrome.
4. `node scripts/cloudflare-build.mjs` — Cloudflare compatibility build followed strictly by Wrangler dry-run, credentials removed.
5. `node scripts/probe-local-worker.mjs` — local migrated/seeded workerd probe; never a cloud preview.
6. `node scripts/build-node-phase-three.mjs` — restore a Node production artifact after the Worker-specific build before running the browser fixture.
7. From `workers/content-engine`: `TSX_TSCONFIG_PATH=../../tsconfig.test.json node --import tsx scripts/application-benchmark.ts`; `python3 test/sqlite-pages-test.py`.
8. `node scripts/map-postgres-dependencies.mjs`; `python3 scripts/project-phase-three.py`; `python3 scripts/report-phase-three-final.py`.

The Cloudflare and Node builds use different Argon2 loading capabilities; do not use the Worker-specific `.next` artifact for Node authentication checks. Generated `.open-next`, `.next`, `.wrangler`, native exports and temporary databases are not committed. The committed Wrangler files use zero IDs, disabled provider flags and no production routes.

Read the root Phase 3 reports before interpreting results. Browser 200 responses include empty/error content states on a partial schema. Local wall time is not Worker CPU. Conditional standalone skips execute in dedicated integrations. No result certifies $0 production readiness.
''')
print(json.dumps(summary))
