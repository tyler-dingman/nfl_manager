# Multi-D1 implementation status

**Implementation INCOMPLETE. Ready for staging: NO. Ready for production: NO.**

This commit adds real, separately provisioned local D1 databases and integrates selected application
repositories. It does **not** make the complete application operate on ten databases. The missing
work below remains engineering work, not an owner-approval gate. The approved approximately 470 MB
retained-reference projection was not treated as a blocker and was not optimized again.

Branch: `poc/multi-d1-implementation`.
Baseline: `fb77a537`; Git ancestry check confirms durable batched polling `c8d80820` is included.
Commit: the local commit containing this report (`git log -1 --format=%H`).
Worktree: `/private/tmp/down-distance-staging-preparation`. Main checkout was not edited.

## Architecture implemented

`packages/storage/multi-d1.ts` centralizes explicit ownership and request-scoped stores. Missing
bindings, repeated binding objects, invalid team IDs and unowned repository calls fail closed.
Single-D1 behavior remains the default; PostgreSQL rollback code and migrations remain intact.
The experimental API mode requires `APP_MULTI_D1=true`; normal configurations do not enable it.
Multi-D1 application contexts reject PostgreSQL fallback.

| Binding | Teams / ownership |
|---|---|
| D1_TEAM_1 | KC DEN LV LAC |
| D1_TEAM_2 | DAL PHI NYG WAS |
| D1_TEAM_3 | GB CHI DET MIN |
| D1_TEAM_4 | SF SEA LAR ARI |
| D1_TEAM_5 | BUF MIA NE NYJ |
| D1_TEAM_6 | BAL CIN CLE PIT |
| D1_TEAM_7 | HOU IND JAX TEN |
| D1_TEAM_8 | ATL CAR NO TB |
| D1_USERS | Auth, profiles, preferences, saved records, Front Office, social/private activity, Trivia/rewards, commerce transactions/catalogs, private sportsbook transfers |
| D1_SHARED | NFL metadata/reference packs, complete cross-team event/odds boards and scores, AI cache, NFL-wide editorial schema |

The ownership contract covers 138 non-shadow application tables; five FTS shadow tables are created
by SQLite. The full historical 184-table inventory also contains legacy POC/rollback tables, which
remain in their original migrations rather than being replicated into every fresh shard.
`workers/multi-d1/table-ownership.json` explicitly assigns every active application table. Unknown
new tables and cross-owner SQL FKs make schema generation fail. Fresh role bootstrap migrations
preserve existing column/ID types, indexes and within-owner FKs. They are **not** a user-data
migration and must never be applied over an existing populated database.

Important ownership changes from the earlier proposed classification: source definitions are
co-located with candidates/evidence/leases/retry inboxes, avoiding cross-database source FKs;
Trivia question/reward catalogs stay USERS to preserve existing transactional joins; complete
cross-team odds boards stay SHARED; actor-owned editorial override records stay USERS.
All ten local databases pass their schema/FK checks. See `workers/multi-d1/README.md`.

## Integration status

| Subsystem | Status and evidence |
|---|---|
| Team routing | PASS for all 32 canonical team IDs in physical D1 routing tests; not all product HTTP routes |
| Authentication | PASS through actual local API/password workerd services with ten separate D1 databases; USERS ownership |
| Auth security | Existing Argon2id parameters and native PHC compatibility preserved; registration/login/reset/expiry/concurrent sessions/logout isolation/restart checked |
| Profiles/preferences | Explicit USERS repository ownership; Three & Out timezone/delivery/email eligibility verified through HTTP |
| Front Office | Repository explicitly selects USERS; complete multi-D1 browser workflow not yet qualified |
| Saved content/bets | Private saved persistence explicitly selects USERS; cross-shard validation, durable pin/receipt saga and reconciliation NOT implemented |
| Editorial | Team public list/page/wire reads select the owning shard. ID-only lookups, publication/ingestion dispatch and global aggregation remain incomplete |
| Three & Out / Film Room | Selected team reads use team stores; reference packs use SHARED; complete generation/notification pipeline not qualified |
| AI Search | Team news retrieval separated from SHARED reference/cache storage; global lexical search dispatch incomplete; no paid inference enabled |
| Parlay Lab | Event/board/reference repositories explicitly select SHARED; private transfers select USERS. Complete application qualification still missing |
| Trivia/rewards/social | Explicit USERS repository ownership and transaction-preserving schema; not multi-D1 browser-qualified |
| Batched polling | Existing optimized single-D1 implementation unchanged. Per-shard schema exists, but continuation ownership, shard selection and job dispatch are NOT integrated |
| Cross-database references | MISSING application validation/receipts/reconciliation protocol; no distributed transaction claim |
| Retention | Existing approved policy unchanged; role-specific GC/root contracts and cross-owner permanent-reference protection are MISSING; old fail-closed schema checks were not relaxed |
| Recovery | New authenticated ten-shard archive format passes integrity tests; coordinated export, actual ten-database restore and cross-reference reconciliation are MISSING |

Unported ambient storage calls deliberately fail rather than selecting USERS or SHARED implicitly.
No authorization check was replaced with a client-supplied team routing decision.

## Queries and capacity monitoring

All ten instrumented databases share one synchronous invocation reservation counter. Batch members
and maintenance-fence SQL count separately. A forced cross-database test reaches exactly 50 and
rejects statement 51 before execution. This is a guard test, not a critical-route performance claim.
Per-owner counters also exist; API telemetry includes them in experimental multi-D1 mode.

The new capacity collector uses supported D1 `meta.size_after`, encoded payload reservations and
pending retention items. SQLite `page_count/page_size` PRAGMAs were rejected by actual D1 and were
replaced. Missing size metadata fails rather than reporting zero usage. A full owner-side scan uses
30 SQL statements; hosted scheduling/alert delivery is not integrated. Status calculation supports
350 MB/450 MB/500 MB levels, daily growth when prior samples exist, and account-wide warnings at
3.5 GB, 3.5 million reads and 70,000 writes. It reports hard quota exhaustion separately.

The existing 64 MB encoded-payload fence remains unchanged. Alerts do not substitute for a proven
admission/cleanup strategy, and no permanent data is deleted. D1's actual platform limits remain
binding. A decade of data is not assumed to fit simply because ten databases exist.

Measured empty role sizes and routing results: `reports/multi-d1-implementation/routing.json`.
Measured auth query/row totals: `reports/multi-d1-implementation/validation/auth-queries.json`.

**Daily D1 reads/writes for the complete multi-D1 engine: UNVERIFIED.** The inherited polling
scenario was 774,999 reads / 68,714 writes at 50 DAU; four-version sensitivity was 74,668 writes
before new coordination. These are prior-model values, not a measurement of the new architecture.
The prior 47-query ingestion maximum likewise does not qualify shard-aware polling.

`reports/multi-d1-implementation/capacity-status.json` enumerates 0/25/50/100 DAU at
30/90/180/365 days, explicitly preserving prior projections as unverified inputs. It does not add
invented zero-cost coordination/backup terms. Storage ownership changed, so the prior approximately
470 MB/team and 4.05 GB/account sensitivity cannot serve as a new complete capacity qualification.
Concentrating complete odds boards in SHARED also needs a new per-database storage bound; the old
team-shard distribution cannot establish that SHARED stays below 500 MB. Worker CPU, mature retention
costs, coordinated recovery operations and hosted account headroom
remain UNVERIFIED. No $0 production-readiness claim is made.

## Recovery and staging preparation

`multi-d1-recovery.ts` encrypts each caller-supplied shard export and a global authenticated manifest.
It binds owner/mapping/window/epoch/digest and rejects missing, mixed-window, swapped and corrupt
archives before returning restore inputs. It does not acquire fences, export BLOB/FTS data, execute
restore SQL or reconcile references. Therefore this is NOT a passed full synthetic restore. The
existing single-D1 owner-managed backup remains the rollback implementation.

`wrangler.api-multi-d1-local.toml` supplies ten distinct synthetic bindings, role migration directories,
no R2, no remote mode, no public workers.dev/preview URL, and no Cron Triggers. The password Worker
remains an internal service. This is a local integration config, **not a deployable staging config**.
Required future hosted layout, isolated secrets, health checks and rollback prerequisites are in
`workers/multi-d1/README.md`. Existing static-asset routing was not changed.

Official documentation checked during this work:

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free permits ten databases,
  500 MB each, 5 GB/account and 50 queries/invocation. Approximately 5,000 bindings fit a Worker
  subject to metadata size, so ten D1 bindings are supported in principle. Only six connections
  may be simultaneous. Free Time Travel is seven days.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): daily reads and writes are
  account-wide, not multiplied by the database count.
- [Worker limits](https://developers.cloudflare.com/workers/platform/limits/): hosted CPU and other
  Free limits still require verification; local wall time is not hosted billed CPU.

No account inspection, remote resource creation, deployment, DNS change, paid service activation,
production access or real email delivery occurred. Browser validation is Chromium desktop/mobile-web;
Android/iOS devices were not built or visually tested. No shared UI was changed.

## Validation

Automated results: **1,228 passing across the root suite and Worker suite plus isolated retry**,
zero unresolved assertion failures, two pre-existing root skips. The root suite passed 1,075 tests.
The full Worker attempt passed 151 tests and cancelled one file at its existing 120-second timeout;
that historical-lifecycle file subsequently passed all three tests alone with the same timeout,
yielding 153 passing Worker tests across attempts. This was **not** a clean single full Worker run.
The browser rerun passed all 48 routes. Ten-database authentication recorded 20 HTTP samples and a
27-statement maximum; the archive integrity test is included in the root count and the two routing
tests are included in the Worker count. TypeScript and formatting checks passed.

Final results are recorded in `reports/multi-d1-implementation/validation/summary.json` and adjacent
logs. The browser runs exercise single-D1 rollback, not the complete multi-D1 application. The initial
browser attempt had one `/huddle` navigation timeout; its evidence is retained in `browser-initial`.
Earlier targeted failures exposed query-fence overhead, unsupported PRAGMAs and an unowned preference
route; these were fixed rather than suppressing assertions or removing tests.

## Remaining blockers and next action

1. Integrate ownership-aware canonical/editorial repositories, global stable-ID lookup and bounded
   cross-team aggregation, including publication/job receipts without exceeding the shared query limit.
2. Implement interrupted-operation-safe saved references, notifications, betting evidence and
   cross-database reconciliation; preserve permanent saves before enabling any shard cleanup.
3. Integrate shard-aware durable polling continuations and registry/job routing. Preserve all source
   intervals, empty-check deduplication and the three-times-weekly odds schedule.
4. Review role-specific retention/GC root schemas; implement coordinated fenced ten-database export,
   ordered restore and corruption/interruption/reference reconciliation tests.
5. Run all major product HTTP/browser workflows and the complete ingestion day against ten databases,
   then rebuild the capacity model with measured coordination/maintenance overhead.
6. Only then prepare and qualify a private hosted staging config, verify real account headroom and
   measure hosted Worker CPU. Deployment remains approval-gated.

Recommended next action: finish the application ownership and reference protocols on this branch.
Do not deploy or interpret this foundational implementation as completion of the requested mission.
