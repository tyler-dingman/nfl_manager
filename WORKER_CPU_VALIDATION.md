# Worker CPU validation — Phase 2

**Status: UNVERIFIED / production launch BLOCKED.** No deployed Cloudflare invocation or billed CPU measurement was obtained. No Worker was deployed. Local workerd/Miniflare, Node process CPU, HTTP wall time, build size and D1 query duration are different measurements.

The [Workers limits documentation](https://developers.cloudflare.com/workers/platform/limits/) lists 10ms Free CPU per HTTP and cron invocation, 128MB memory, 50 subrequests and six simultaneous outgoing connections. Waiting for I/O is excluded from CPU. A daily average cannot prove that a busy request satisfies the per-invocation limit.

## Executed local evidence

The isolated lean Worker dry-run bundles at 21.68KiB / 5.82KiB gzip. It is an editorial POC, not a bundle of all Next.js APIs. The complete Node Next.js production build passes separately. Root Next.js and Worker typechecking use separate projects to avoid importing incompatible global runtime types.

`reports/zero-cost-phase-2/local-cpu-benchmark.json` records Node v22.14.0 ARM64, ten samples/operation. Median Node CPU: Argon2id hash 16.887ms, verify 18.541ms; JSON parse/stringify of ~8KB 0.049ms, ~512KB 3.100ms, ~17.51MB 101.773ms. These are local process measurements, including native threads. Node RSS rose to ~521MB during the large JSON case; this is not a Worker isolate memory measurement or a precise per-operation allocation. Do not transplant native Argon2 or a full odds document into Free Workers on the strength of a small editorial bundle.

Retained Phase 1 `zero-cost-full-feed.json` measured ten local samples with two real emulator R2 buckets: article median wall 22.51ms, homepage full 20-object feed 138.98ms, team full feed 120.57ms, historical revision 18.92ms, historical metadata search 6.00ms. D1/R2 counts per request were respectively 2/1, 41/20, 40/20, 2/1, and 20/0. Counts are measured; wall time and coordinator CPU do not establish billed Worker CPU. The public payload reader caps object concurrency at four.

Finalized FO-1 tests measure actual loopback PostgreSQL protocol bytes and direct-route latency. A small command still transfers ~2.11MB toward PostgreSQL and receives ~2.32MB, with seven SELECTs and four writes. Its mutable JSON is ~232KB, compressed database datum ~32.5KB; shared references are retransmitted. Replay performs zero writes, with much smaller transfer. See `front-office-integration.log`; this is not Cloudflare CPU or current Neon billing.

## Required path matrix

| Path                      | Local evidence                                                                                    | Actual Worker CPU / isolate memory / production subrequests |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Homepage                  | Node production build and browser viewport checks; lean feed emulator read counts                 | UNVERIFIED                                                  |
| Team page / team feed     | KC/SEA Beat checks and lean team-feed counts; full team page not separately qualified             | UNVERIFIED                                                  |
| The Beat                  | Local browser checks and source/story regression tests                                            | UNVERIFIED                                                  |
| Film Room                 | Canonical `/watch` checked locally; video regression tests                                        | UNVERIFIED                                                  |
| AI search                 | Unit contracts for retrieval/synthesis; production BGE/Ollama/Whisper host not exercised          | UNVERIFIED                                                  |
| Front Office              | Owned PostgreSQL create/read/mutate/replay/recovery/restart/forced-GC tests                       | UNVERIFIED                                                  |
| Parlay Lab                | Local browser renders with synthetic partial schema/empty odds; normalization/transfer unit tests | UNVERIFIED                                                  |
| Trending and slip builder | Existing application unit coverage; no production-sized full board CPU trace                      | UNVERIFIED                                                  |
| Authentication            | Native hash measurements; real local HTTP signup/session/restart plus reset rollback              | UNVERIFIED                                                  |
| Ingestion                 | Existing conditional fetch/dedupe/quota tests and synthetic schedule slots; no live ingestion     | UNVERIFIED                                                  |
| Editorial generation      | Lean persistence tests; no production inference or full generation CPU trace                      | UNVERIFIED                                                  |

The planning session has 28 product API calls plus six SSR navigations and six middleware `/api/auth/me` self-requests = 40 Worker executions/DAU/day before a 1.2 multiplier, plus background work. Browser asset loads, API fan-out, authorization checks and cache misses must be measured end-to-end before accepting even this estimate. A cache hit in a Worker still invokes that Worker; only actual asset/CDN routing can avoid it. No authenticated response may enter a public cache.

## Validation required before approval

Build a full Cloudflare-compatible artifact with the selected auth and persistence adapters. Current official guidance recommends beta vinext and describes OpenNext separately; the existing Next 14 application must not be assumed compatible with a Next 16 migration path. Native Argon2, JSONB/vector dependencies and large synchronous compression require explicit solutions preserving security and game behavior.

After separate staging approval, use a Free-only synthetic account with explicit resource identities and paid overages disabled. Exercise warm/cold and cache hit/miss paths for every row above, worst-case payloads and concurrent sessions. Export Cloudflare CPU p50/p95/p99/max and `exceededCpu`, actual outcomes, request counts, memory/resource errors, outbound counts, D1 `rows_read`/`rows_written`, R2 operations and cache status. Correlate by sanitized request IDs, never session tokens or user payloads. Require p99 near a 7ms planning target with actual maximum/error analysis; do not replace the 10ms hard limit with a percentile average. Reconcile all account usage, including other Workers/databases/buckets. Staging/account telemetry remains an unmet requirement, not a permission granted by this report.
