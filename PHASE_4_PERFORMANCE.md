# Phase 4 performance

Request-scoped D1 metadata instrumentation and R2 counters remain. The final probe records local cold/warm wall time, statuses and null Worker CPU. Compression executes in actual local workerd. Worker Free 10 ms CPU, startup and memory remain UNVERIFIED; no production trace is available or requested.

Implemented: shared immutable subtrees, gzip, duplicate checkpoint elimination, compressed/reused directory chunks, bounded maintenance, primary-key settings CAS and cursor-style odds paging. D1's existing batched commit/row guards remain. An opt-in 30-second public cache is restricted to credential-free `/api/parlay-lab/events` without query strings; private/no-store, Set-Cookie, errors and Vary:* are excluded. It is disabled by default and is not credited in capacity projections. Existing public editorial response caching remains. Precomputed Lab Score/Trending Props and complete board caching are unfinished.

Ordinary game history measured 8,400 object reads / 1,507 writes across 400 commits, including verification; 21.0 reads/commit. This is not a latency or CPU win claim. Storage sharing can amplify reads; the model charges additional operations. All prior operation counts are retained as lower bounds, with no credit for unported workload reductions.

Scale D1 seed/commands metadata: {"d1Calls": 1177, "statements": 17005, "rowsRead": 3701, "rowsWritten": 47005}. This excludes the separately instrumented cumulative backup/restore SQL and object counters in the recovery report. Internal R2 calls and external fetch limits differ; no 50-external-fetch claim is incorrectly applied to internal R2. Daily backup is an offline multi-invocation tooling problem, not a single qualified Free scheduled Worker job.

| DAU | Worker requests/day | D1 reads/day, lower bound | D1 writes/day, lower bound | D1 MB, 365d | R2 GB, 365d | R2 A/month, lower bound | R2 B/month, lower bound |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 | 13,798 | 2,016,994 | 70,911 | 382.99 | 22.96 | 272,355 | 10,827,643 |
| 500 | 36,851 | 2,284,322 | 81,311 | 624.85 | 36.09 | 285,817 | 14,474,233 |
| 1000 | 65,668 | 2,618,482 | 94,311 | 927.17 | 52.51 | 302,644 | 19,032,493 |
| 1500 | 94,484 | 2,952,642 | 107,311 | 1229.49 | 68.94 | 319,472 | 23,590,753 |
| 2000 | 123,301 | 3,286,802 | 120,311 | 1531.81 | 85.36 | 336,299 | 28,149,013 |
| 3000 | 180,934 | 3,955,122 | 146,311 | 2136.45 | 118.20 | 369,954 | 37,265,533 |
| 5000 | 296,201 | 5,291,762 | 198,311 | 3345.73 | 183.89 | 437,263 | 55,498,573 |

Production CPU, actual cache hit ratio, concurrent peak traffic, fanout, source ingestion volume and complete business-path amplification remain unverified. The workload already misses D1-write and R2-read headroom. Extra databases do not multiply account-wide daily quotas.
