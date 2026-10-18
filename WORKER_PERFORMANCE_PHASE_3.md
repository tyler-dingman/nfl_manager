# Worker performance — Phase 3

**Actual Cloudflare Worker CPU: UNVERIFIED.** No cloud preview or production invocation was run. Node/Miniflare/workerd wall time is not billed CPU. Workerd timers can remain zero inside one I/O turn; no Free CPU compliance is inferred from them.

Instrumented D1 operations use actual returned rows_read/rows_written metadata and statement/call counts. R2 counters include initial existence lookups and verification reads. The Worker logs sanitized route families, status, wall-to-headers, D1/R2 operations and an explicit null CPU field. Header-time metrics omit some later streaming/background work and are a lower bound, not full-invocation accounting.

Cloudflare publishes CPUTimeMs separately from WallTimeMs. The JSONL trace parser computes route-family CPU p50/p95/p99/max, rejects wall-only observations and strips private paths/query tokens. A synthetic parser test cannot qualify production CPU. Collect sufficiently sized provenance-verified cloud exports for every required path. No billed Tail Worker/Logpush sink was enabled. [Timing fields](https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## Actual local Next handlers on D1

| Handler | Status | Node wall ms | D1 calls | Rows read | Rows written |
|---|---|---|---|---|---|
| /api/auth/signup | 201 | 79.47 | 9 | 6 | 24 |
| /api/auth/me | 200 | 6.25 | 2 | 2 | 0 |
| /api/auth/verify-email | 200 | 17.62 | 1 | 10 | 9 |
| /api/user/preferences | 200 | 11.98 | 4 | 4 | 1 |
| /api/user/email-subscriptions | 200 | 9.01 | 3 | 2 | 1 |
| /api/user/email-subscriptions | 200 | 8.46 | 4 | 4 | 0 |
| /api/auth/login | 200 | 40.34 | 7 | 6 | 10 |
| /api/auth/forgot-password | 200 | 17.79 | 4 | 3 | 8 |
| /api/auth/reset-password | 200 | 24.73 | 2 | 15 | 10 |
| /api/auth/login | 200 | 39.88 | 7 | 6 | 10 |
| /api/user/saved-content | 201 | 9.59 | 3 | 3 | 3 |
| /api/user/saved-content | 200 | 6.44 | 3 | 4 | 0 |
| /api/user/saved-content | 200 | 21.52 | 3 | 4 | 0 |
| /api/user/preferences | 200 | 8.94 | 3 | 3 | 0 |
| /api/search | 200 | 4.74 | 1 | 1 | 0 |
| /api/auth/logout | 200 | 4.18 | 1 | 1 | 1 |

Standalone preference reads perform one indexed read and zero writes; the previous ensure-settings no-op write is absent. Other improvements include batched metadata CAS, shared inference/source keys, coalesced freshness reads, bounded mail pages/drains and durable duplicate job exclusion. They do not complete unported relational gameplay or score-precompute transactions.

## Local production Node HTTP benchmark

Five requests per family on partial synthetic PostgreSQL. Failed AI/odds responses and ingestion admission rejection remain unavailable paths, not successful-work benchmarks. Bet Slip uses the real My Plays route; it does not execute a real bet.

| Family | Observed statuses | Median wall ms | Max wall ms |
|---|---|---|---|
| Homepage | 200,200,200,200,200 | 6.45 | 55.71 |
| The Beat | 200,200,200,200,200 | 13.99 | 44.54 |
| Film Room | 200,200,200,200,200 | 2.69 | 6.19 |
| AI Search | 200,200,200,200,200 | 1.76 | 34.26 |
| Front Office | 200,200,200,200,200 | 2.66 | 5.24 |
| Parlay Lab | 200,200,200,200,200 | 2.72 | 8.66 |
| Trending Props | 503,503,503,503,503 | 0.90 | 4.27 |
| Bet Slip | 200,200,200,200,200 | 2.96 | 5.01 |
| Authentication | 200,200,200,200,200 | 1.10 | 1.37 |
| Editorial ingestion admission | 503,503,503,503,503 | 0.97 | 4.76 |

Cold/warm local workerd observations are in CLOUDFLARE_HOSTING_IMPLEMENTATION.md. Original editorial operation measurements remain inherited Phase 2 evidence, not rerun cloud CPU. Ingestion admission timing measures rejection only; local D1 tests exercise actual jobs/archives. A real Worker ingestion CPU measurement remains required.

The 100-account fixture performs 1224 D1 calls, 1557 statements, 1122 row reads and 3555 row writes, with six saved records/account, one session/account and eleven retained high-entropy game revisions. R2: 56 reads, 22 writes and 46203258 uploaded bytes across two verified copies. These offline loops are not single Worker invocations.

Before launch, collect actual CPU/startup/memory/error/cache metrics for Homepage, Beat, Film Room, AI Search, Front Office, Parlay Lab, Trending Props, Bet Slip, auth and ingestion. Free internal-service subrequests have a separate 1,000 limit; external fetches are limited to 50, and D1 query limits are separate. Free CPU is per invocation; additional D1 databases do not enlarge it. Unqualified hashing and unbounded large private-list R2 fanout remain blockers.
