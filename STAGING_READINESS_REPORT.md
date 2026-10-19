# Staging readiness — local review only

Baseline `56834b13`, isolated branch `poc/cloudflare-staging-blockers` in `/private/tmp/down-distance-staging-blockers`. No deployment, production database/account access, paid service activation, or existing editorial/user-data deletion. PostgreSQL remains the default and its migration history is intact.

| Required result | Status |
|---|---|
| Password runtime | **PASS in actual local workerd**; hosted Free CPU is unqualified |
| PostgreSQL-free operation | **FAIL for the whole application**; qualified D1 workflows below pass |
| D1 migration | **PARTIAL** |
| R2 projected storage, 365 days / inherited 1,000 DAU | **8.74 GB** at measured low-churn sensitivity; **9.34 GB** at 10% daily deltas; **14.94 GB** at full churn |
| Recovery validation | PASS: 5,000 synthetic users, 5,000 saved bets, original IDs, immutable histories and interrupted restore |
| Worker runtime | Local password + split web/API HTTP tests pass; hosted CPU/memory/account quotas unverified |
| Automated tests passed | **1199**, plus **48** browser cases and **58** split Worker HTTP samples |
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

Scale evidence: weekly directory **556,732 bytes**, daily delta **2,075 bytes** for 100 changed users / 200 row operations; weekly capture **31.67s**, delta **11.69s**, restore **35.08s** locally. Original user/saved/market IDs, 401 game versions, 100 franchise heads and a 2.1-MB high-entropy value survive. Corruption, missing patches, interrupted restore, replay and interrupted directory-prune retry are tested. Retention first persists an encrypted delete ledger; retries can finish after some directories are already absent.

Annual payload breakdown: historical editorial/other inherited payloads 2.942 GB; Front Office history 0.456 GB; odds history 0.250 GB; shared AI 0.299 GB; configuration/attachments 0.066 GB; newly modeled saved metadata, identities, scores and public payloads 3.462 GB. Two payload copies are retained intentionally. Unknown domain volumes remain unknown.

| Days | D1 MB | Old R2 GB | Payload floor GB | Weekly + daily, low churn GB | Full-churn GB |
|---|---:|---:|---:|---:|---:|
| 30 | 190.9 | 1.90 | 0.67 | 0.92 | 2.11 |
| 90 | 305.3 | 6.85 | 1.89 | 2.36 | 5.02 |
| 180 | 476.8 | 17.50 | 3.72 | 4.45 | 8.49 |
| 365 | 829.4 | 51.50 | 7.48 | 8.74 | 14.94 |
| 730 | 1525.0 | 166.42 | 14.89 | 17.22 | 28.99 |
| 1095 | 2220.6 | 344.81 | 22.30 | 25.69 | 43.39 |

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
