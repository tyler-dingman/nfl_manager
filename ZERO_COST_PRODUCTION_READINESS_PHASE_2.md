# Zero-cost production readiness — Phase 2

2026-10-16. Branch: `poc/zero-cost-production-readiness-phase-2`.

## 1. Executive summary

**BLOCKED. A complete, verified $0 operating path has not been established.** No nonzero whole-product DAU is certified. This does not mean the product can never operate free; it means the required hosting, CPU, inference, messaging and private-data evidence is incomplete, with specific modeled failures below.

The isolated branch integrates selected lean editorial POC `ae40533f`, completed application/source work `f5276dfc` (including main `5e1a6ec5`), and the finalized FO-1 durable-route/test changes from `afe79c90`. Integration exposed a real difference: f5276dfc contained an earlier Front Office request-body implementation. The finalized consume-once/reconstructed-request fix eliminated the reproduced recovery failure. No production code, database, provider setting, subscription, DNS or deployment was changed.

Local additions: transactional password-reset consumption/password change/session revocation; enforced 32-character signing/encryption secrets; explicit paid-OpenAI refusal in zero-cost qualification mode; coherent lean D1/R2 checkpoint with corruption preflight and empty-target restore; durable three-weekly scheduling slots with concurrent/restart duplicate protection; full owned game-schema dump/restore rehearsal; infrastructure inventory, capacity model and reproducible validation scripts. No AI model or product feature was silently removed.

## 2. Recommended architecture

Keep **lean D1 directories + private immutable R2 payloads with verified second copies** as the editorial target. Keep PostgreSQL authoritative for existing private application transactions until a separately reviewed adapter migration preserves ownership, concurrency, receipts, rollback and search. This is a safe integration state, not the requested final all-$0 production architecture.

For a future D1 application adapter, colocate user/game state and command receipts for atomic updates; keep large shared game references and odds/raw payloads in R2 with verified CAS pointer commits. Never split a transaction across databases merely to gain storage. Additional D1 databases share daily quotas. R2 backups require retained reference inventories and a coordinated recovery epoch. The current Node host, native Argon2 and pgvector search remain dependencies; switching them without equivalent behavior is not approved by a cost model.

Tradeoffs were recorded before integration in `reports/zero-cost-phase-2/ARCHITECTURE_DECISION.md`. One optimized D1/R2 editorial store remains simpler than two/three databases, but multi-year limits require a later metadata partitioning plan. Retaining PostgreSQL is compatible with current functionality, not proven within Free compute/transfer quotas. The prior architecture comparison remains in `ZERO_COST_PRODUCTION_READINESS.md` and `workers/content-engine/D1_R2_STORAGE_FINAL_RESULTS.md`.

## 3. Services and costs

See [the complete infrastructure register](PRODUCTION_INFRASTRUCTURE_AUDIT.md). **Projected whole-product monthly cost: UNVERIFIED, not $0.** The editorial Cloudflare numeric component model fits Free at 1k DAU subject to CPU, correct integration, all-account usage, provider enrollment and billing controls. No paid service was activated and no production/current billing measurement was obtained.

Public official pricing was checked; account-specific plans, usage, traffic-based entitlements, commercial permissions, domain/app-store fees and overage controls remain unverified. Open-source inference software is not a hosted free service.

## 4. Neon elimination

**NOT eliminated.** Both the newer application and the POC still depend on PostgreSQL for auth, preferences, saved content, game state, rewards/trivia, odds, editorial origin repositories, search and commerce. Static inventory lists table declarations and PostgreSQL-specific constructs. Migration is architectural work, not SQL string replacement.

Five-minute briefing delivery can keep a 0.25CU Neon instance active: 0.25 × 24 × 30 = 180 CU-hours/month against the published 100/project allowance. This is a nominal calculation, not current account usage. Continuous user traffic can create the same risk after polling is removed. Other jobs also wake the database. Existing next-due POC ideas must preserve timezone/DST preference changes, catch-up, lost acknowledgements and delivery status. No notification subscription or polling job was disabled to improve a number.

Moving even the old planning allowance of four private writes/DAU/day into D1, with the existing 1.2 multiplier, adds 4,800 writes/day at 1k DAU. The ~67.7k editorial floor then exceeds the 70k headroom target, before extra indexes/game/odds writes. This sensitivity allows only about 476 DAU under that write target; it is not a complete migrated workload model or a whole-product capacity claim.

## 5. Worker CPU

**UNVERIFIED.** [WORKER_CPU_VALIDATION.md](WORKER_CPU_VALIDATION.md) separates actual local Node CPU, emulator row/object counts, HTTP wall times and required Cloudflare measurements. No billed Worker CPU or actual isolate memory/production fan-out was measured. Local native password hashing and large odds JSON processing are material concerns; password security was preserved.

## 6. Hosting

The complete Next.js production build passes locally, with existing lint warnings. Worker dry-run build and separate typechecking pass. Root TypeScript now excludes the separate `workers` project, which has its own checked runtime types; no application checks were disabled.

Pages/static export alone cannot host dynamic APIs, revocable sessions and SSR. Static Assets can host eligible assets, but hybrid routing still needs a qualified dynamic host and must retain deep links/SEO/auth/mobile APIs. Current Cloudflare documentation recommends beta vinext and retains OpenNext guidance; this existing Next 14/React 18 app has not been migrated to either Cloudflare full-app path. Native Argon2 is not established as compatible. Vercel Hobby commercial eligibility cannot be presumed for this application. Production hosting remains UNVERIFIED.

## 7. AI inference

Current local BGE/Ollama/Whisper/Chatterbox endpoints have no verified zero-cost production host. Preserve grounded answers, citations, embeddings, editorial quality and voice; deterministic summaries are not treated as equivalent inference. Workers AI is a candidate only. The audit's explicit token/cache assumptions yield ~28.6k neurons/day at 1k DAU before audio, exceeding Free's 10k and the 7k headroom target.

`INFRASTRUCTURE_COST_POLICY=zero-cost` blocks the optional paid OpenAI call before fetch and reports an error; it does not silently pick another model. This mode must be explicitly configured. Existing explicit standard-mode behavior remains available. It is not a global provider/account billing cap, and this branch has not turned on a production zero-cost mode that would break required AI.

## 8. Email and push

Production verification/reset tokens are persisted but no actual recovery-mail adapter sends them. Crew email/SMS delivery also lacks an implemented provider. The auth rollback fix proves durable token/password/session handling, **not email delivery**. No message was sent.

Daily subscriber demand plus a small recovery reserve is modeled below. Resend Free allows 100/day and 3,000/month; Brevo Free 300/day, with plan/domain/consent/account conditions still to verify. None supplies a verified 1k-daily-subscriber path. Required opt-ins cannot be silently moved to push or suppressed.

<!-- GENERATED_EMAIL -->

| Daily subscribers | Emails/day incl. recovery reserve | 30-day emails | Resend Free | Brevo Free |
| --- | --- | --- | --- | --- |
| 100 | 110 | 3300 | Exceeds 100/day or 3,000/month | Fits numeric limit only |
| 500 | 510 | 15300 | Exceeds 100/day or 3,000/month | Exceeds 300/day |
| 1000 | 1020 | 30600 | Exceeds 100/day or 3,000/month | Exceeds 300/day |
| 2000 | 2040 | 61200 | Exceeds 100/day or 3,000/month | Exceeds 300/day |
| 5000 | 5100 | 153000 | Exceeds 100/day or 3,000/month | Exceeds 300/day |

<!-- END_GENERATED_EMAIL -->

Web Push/Expo code exists; production quotas, delivery receipts, abandoned PENDING recovery, provider acknowledgement behavior and Android/iOS device tests remain unqualified. Daily email subscribers are not the same as DAU; using five registered users/DAU and 50% opt-in would require more mail than a one-email/DAU shortcut.

## 9. Parlay Lab ingestion

The isolated scheduling primitive admits Monday/Wednesday/Saturday at 15:00 UTC, exactly three windows/week including DST boundaries. One durable token claims each slot. Concurrent delivery and restart do not repeat a provider attempt. STARTED/UNCERTAIN records require reconciliation after ambiguous failure; no TTL blindly spends another request. This favors explicit missed-refresh recovery over duplicate quota consumption.

**Production schedule integration is unfinished.** No deployed cron or provider call was activated. The primitive accepts an injected adapter and is covered by synthetic tests; it is not a claim that odds already refresh automatically. A reviewed dispatcher, provider-specific persistent quota budget, supported coverage and web/native snapshot freshness display remain required.

At ≤15 runs/31 days × 16 NFL event objects/run, SGO demand is ~240 objects before manual imports/other consumers, below the code's 1,000-object ceiling and published 2,500-object Amateur allowance. Actual entitlement and redistribution are unverified. Unabated Free requires tracked partner links and qualifying access; no numeric account traffic target was obtained. Existing alt lines through -1000, FD/DK transfers, book flags, preserved selections and saved plays were not replaced or narrowed. Full-data load and actual sportsbook execution were not validated locally.

New source registrations stay disabled. The source audit's larger 400-candidate/day scenario fails the storage target; admission must check measured candidate growth, conditional fetches, dedupe, CPU and rights, not source count alone.

## 10. Database projections

The inherited entropy-case lean editorial projection was 321.16MB D1 / 6,025.14MB R2 at day 365. A measured synthetic year of scheduling metadata adds 49,152 SQLite bytes for 156 rows with 200-byte summaries. With the existing page/backup reserves, the integrated POC projection is **321.21MB D1 / 6,025.71MB R2**. At the allowed maximum 32KB summary, measured table allocation is 5,210,112 bytes; projected totals become **327.41MB / 6,085.16MB**. Neither includes migration of private auth/game/odds/vector state. Sizes use decimal MB.

Two verified editorial payload copies and eight full D1 directory snapshots are included. PostgreSQL backups, all private-state retention, images if moved from Static Assets, other account buckets and any new AI assets are not included. Original IDs, evidence attribution and historical revisions remain intact. No existing user/editorial data was removed; cleanup is limited to owned synthetic fixtures.

<!-- GENERATED_STORAGE -->

| Days | D1 MB | R2 MB | Scope |
| --- | --- | --- | --- |
| 30 | 54.41 | 764.18 | PROJECTED editorial + typical schedule only |
| 90 | 102.20 | 1,706.54 | PROJECTED editorial + typical schedule only |
| 180 | 173.88 | 3,120.09 | PROJECTED editorial + typical schedule only |
| 365 | 321.21 | 6,025.71 | PROJECTED editorial + typical schedule only |
| 730 | 611.91 | 11,758.42 | PROJECTED editorial + typical schedule only |
| 1095 | 902.60 | 17,491.14 | PROJECTED editorial + typical schedule only |

<!-- END_GENERATED_STORAGE -->

At two years, even the editorial-only single D1 store exceeds its 500MB per-database allowance and R2 exceeds 10GB. Historical metadata partitioning, backup retention/compaction and a complete private-data model are blockers to multi-year qualification; no history was dropped to hide growth.

## 11. Backup and recovery

The new lean checkpoint obtains one D1 batch directory snapshot, copies and verifies every referenced immutable object, retains original IDs/revisions/source metadata and validates manifest/object hashes before SQL restore. Restore requires an empty exclusively held target and stages R2 objects before one atomic D1 batch. Tests include a near-512KB payload, tampered manifest, corrupt object, historical source lookup and duplicate/nonempty-target refusal. This offline fixture tool is bounded to 50 insert statements; large staged production restore is **not implemented**. It does not export legacy D1 tables or private PostgreSQL data.

The PostgreSQL runner starts its own localhost-only cluster, replays selected additive migrations twice and dumps/restores synthetic auth/user/game-metadata data with per-table fingerprints. A separate full game-schema checkpoint verifies owners, sessions, reference bundles, durable runtime, recovery evidence and command receipts from the actual game suite. Dumps and servers are cleaned up only within owned temporary directories. The first route-level recovery test reproduced the older clone-body failure; finalized FO-1 fixes are integrated and revalidated.

<!-- GENERATED_RECOVERY -->

Synthetic auth/user metadata restore: 50 tables matched; 1,095,676-byte dump, 0.156s export, 1.147s restore/verification. Full owned game-schema restore: 16 tables matched, 27,738,060-byte dump, 0.360s export and 1.236s restore/verification. These are small local rehearsals, not production RTO measurements.

<!-- END_GENERATED_RECOVERY -->

These separate rehearsals do **not** establish a coherent production checkpoint across all PostgreSQL editorial, odds, game, D1 and R2 stores. Production RPO/RTO, encrypted/off-account backup placement, key recovery, immutable retention, orphan inventory and full-scale chunked restore remain UNVERIFIED. A proposed daily backup targets ≤24h RPO, not an observed guarantee. The current R2 projection contains the original two copies/eight directory snapshots, not an uncounted full private database backup system.

## 12. Tests

<!-- GENERATED_TESTS -->

| Executed check | Result |
| --- | --- |
| Original + new D1/R2 tests | 78/78 pass, including ancestral archival regressions |
| Full application Node suite | 1033 pass, 17 fail, 2 skipped (1052 total) |
| Unchanged f5276dfc baseline | 1026 pass, 22 fail, 2 skipped; every Phase 2 failure reproduced on baseline |
| Finalized FO-1 + complete game checkpoint | 21/21 pass |
| Actual PG auth rollback, concurrent reset, restart and owner isolation | 2/2 pass |
| SQLite physical page audit | 2/2 pass |
| Next production build; root/native/Worker TypeScript; lean Worker dry-run | Pass; native TypeScript is not a device build |
| Local production Next HTTP + Chrome | Four account/security/restart checks; 20 canonical route/viewport checks at 1440/390 widths, KC/SEA, all HTTP 200 with no horizontal overflow |
| Fresh full SQL migration sequence | Stopped at 017_search_documents.sql because local pgvector extension is unavailable; not a completed full-schema integration |
| Android/iOS device or simulator, cloud CPU, actual provider delivery | UNVERIFIED / not executed |

The 17 retained failures are listed in `validation-summary.json`: Next/font/standalone JSX test environment issues, stale UI/source-contract assertions, a preview/session expectation, existing draft/trade grading assertions, and the legacy projection test. They were not skipped or rewritten to claim a clean suite. The unrelated grading behavior was preserved. Two existing skips remain explicit. Browser checks exercised empty/fallback data states; KC mobile and SEA desktop Beat screenshots were visually inspected, including stale cached briefing age labels. Native Android/iOS rendering was not visually checked.

<!-- END_GENERATED_TESTS -->

No live provider ingestion, model execution, email, actual sportsbook transfers, production database or Cloudflare deployment was exercised. Chromium uses actual local Next.js HTTP/auth/storage; pages use a partial synthetic PostgreSQL schema and can render fallback/empty states. A successful shell/render is not a qualified production-data integration. The full migration rehearsal records its first unsupported dependency rather than altering migration SQL to conceal it. Existing broad-suite failures remain explicit launch blockers.

## 13. Security and operations

Verified locally: signed/opaque session behavior, private saved-content rejection, owner isolation, same-origin controls already present in auth/game flows, Argon2 parameters preserved, minimum signing/encryption secret length, atomic password recovery rollback, durable game version/receipt handling, replay, failure rollback, staged checkpoint checksum verification and duplicate scheduling. No secrets were read from environment files or committed. Validation uses synthetic URLs/credentials; browser/server external sockets are denied. Local build may fetch public fonts; no production app was contacted.

Remaining: global durable abuse quotas (current auth limiter is a process Map), complete cross-route authorization/CSRF audit, secure account/provider enrollment, secret rotation recovery, log retention and redaction policy, health/metrics/alert SLOs, bounded worst-case inference/ingestion and request bodies, delivery leases/reconciliation, reviewed migrations, disaster-recovery keys, exact spending/overage controls. New local scheduler/checkpoint helpers are not public API endpoints. Unverified service failure cannot enable a paid fallback.

## 14. Maximum verified $0 DAU

**Not established; zero DAU certified for the entire product.** Whole-product capacity is the minimum of all required services, several of which lack a working qualified path even before traffic. Nominal Neon polling already exceeds its published compute allowance; missing mail delivery and unmeasured Worker CPU are functional/qualification blockers.

<!-- GENERATED_TRAFFIC -->

| DAU | Worker requests/day | D1 reads/day | D1 writes/day | R2 A / 30 days | R2 B / 30 days | 30% headroom failures |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 12,786 | 1,982,994 | 67,711 | 256,248 | 1,186,800 | None numerically |
| 500 | 31,986 | 2,114,322 | 67,711 | 256,248 | 2,631,390 | None numerically |
| 1000 | 55,986 | 2,278,482 | 67,711 | 256,248 | 4,437,150 | None numerically |
| 1500 | 79,986 | 2,442,642 | 67,711 | 256,248 | 6,242,910 | workerRequestsPerDay |
| 2000 | 103,986 | 2,606,802 | 67,711 | 256,248 | 8,048,670 | workerRequestsPerDay, r2ClassBPer30Days |
| 3000 | 151,986 | 2,935,122 | 67,711 | 256,248 | 11,660,190 | workerRequestsPerDay, r2ClassBPer30Days |
| 5000 | 247,986 | 3,591,762 | 67,711 | 256,248 | 18,883,230 | workerRequestsPerDay, d1ReadsPerDay, r2ClassBPer30Days |

<!-- END_GENERATED_TRAFFIC -->

The modeled editorial Cloudflare component ceiling is **1,291 DAU with 30% quota headroom**, including middleware self-requests and the new small scheduler directory. A full 20-object public-miss sensitivity lowers it to about 940 DAU. These are estimated component ceilings; actual per-request CPU, other account usage, all private writes, AI/email/odds/hosting eligibility can lower them. The earlier 1,765 number used 20% headroom and omitted the additional session HTTP calls; it is not retained as a whole-product claim.

## 15. Remaining production blockers

1. No verified full-application $0 host or Cloudflare-compatible artifact/actual CPU traces.
2. Neon remains authoritative, with polling and transfer/compute risks; D1 transactional/private/vector migration is incomplete.
3. No qualified zero-cost inference host preserving quality and all AI/voice features.
4. No actual recovery/verification email adapter or sustainable required subscription capacity at target scale.
5. Three-weekly odds provider/cron integration, durable global budgets, partner eligibility and snapshot freshness UI unfinished; actual FD/DK execution unverified.
6. No coherent full-product cross-store backup/restore or measured production RPO/RTO; new lean restore is fixture-sized.
7. Broad existing tests fail; a local partial schema cannot qualify all data-backed pages/APIs. Native device behavior and push remain unverified.
8. Multi-year metadata/backup growth exceeds Free single-store allowances; expanded source scenarios exceed the current baseline budget.
9. Account-wide usage, billing controls, commercial permissions, CI minutes, monitoring and distribution costs are unverified.

## 16. Deployment checklist

Do not deploy this branch as a ready production system. Before a deployment request: resolve the blockers with concrete provider/account evidence; choose and validate a complete transaction-preserving migration/hosting plan; run all critical/broad suites and full-schema production-like integration; qualify every CPU path on an explicitly approved synthetic Free staging account; reconcile all account resources and quotas with 30% headroom; verify source/provider rights and actual sportsbook selections; validate recovery mail/push on devices; rehearse a full synchronized restore and secret recovery; confirm feature/URL/SEO/mobile parity, alerts, failure modes and spending controls. Then present the exact migration/deployment artifact and rollback checkpoint for separate approval. Nothing in this checklist authorizes production access or paid infrastructure.

## 17. Rollback

This work is local and additive. Do not execute the POC migrations on production. Keep PostgreSQL and existing APIs authoritative until explicit cutover approval. A code rollback returns to the selected prior POC or reverts the Phase 2 integration commit; do not reverse-drop tables or delete data. Before any future migration, export originals and verified immutable objects, retain migration journals/IDs/revisions and record a consistent checkpoint. Roll back pointers/adapters only after validating ownership and post-checkpoint writes. Auth secret enforcement requires an adequate secret; do not rotate secrets without retaining encrypted-data recovery capability. Ambiguous odds attempts must be reconciled, not cleared and retried automatically.

## 18. Recommended next action

Review this isolated implementation and the explicit blocked $0 conclusion. The next architecture decision must resolve auth-compatible hosting, all private PostgreSQL transactions, inference and required email economics together. Do not authorize a production cutover from an editorial-only cost estimate. Subsequent staging/provider verification requires separately scoped approval; this work stops for review with no deployment, production access or paid activation.
