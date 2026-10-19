# Performance optimization — measured local results

Isolated branch `poc/cloudflare-staging-blockers`, baseline `56834b13`. No production deployment or remote database access. The existing Node/PostgreSQL rollback build and split web/API Worker architecture were inspected before optimization. React Native Android/iOS screens remain native; this change adjusts request behavior, not screen rendering.

## Baseline, method and limits

Before: the baseline production `.next` build, selected KC team, authenticated synthetic account. After: the final production build with the same fixture and benchmark script. Eleven areas were sampled at mobile 390×844 and desktop 1440×1000. Mobile CDP throttle: 1.6 Mbps down / 0.75 Mbps up / 100-ms latency / 4× CPU slowdown; desktop 10 / 5 Mbps / 40 ms / 1×. Cold browser contexts, 3-second post-DOM observation, one sample per route/device. Server image-cache state was not standardized: the baseline reused a prior built cache, while new image derivatives initially needed processing. This limits causal comparisons of page paint. These are local laboratory samples on a shared host, not statistically controlled distributions or production RUM. The local Next server blocks provider connections; browser asset requests can still include public external images. Optional synthetic-schema failures/empty responses are retained in the JSON, not counted as populated workflow success.

LCP, CLS, TTFB, completed-resource JS transfer and API timings were recorded. Event Timing measures a benign local interaction where available; **field INP is unsupported here**. Null interaction samples mean unmeasured. The AI Search sample opens the search overlay; it does not qualify hosted AI answer latency. Trending Props and Bet Slip are identified Parlay routes/states, without provider transactions. Database counts and cache hits are measured separately in local workerd, not inferred from browser paint.

Raw evidence: `reports/performance/before-team/web-vitals.json`, `final/web-vitals.json`, `route-bundles.json`, `query-plans.json`, `before/public-api.json`, `after/public-api.json`. `before/` also retains the initial unselected-team run. `after-team/` retains an abandoned lazy-loading/delay experiment; it is not the final implementation. Script transfer bytes include completed prefetch resources, so deterministic initial route bundles are reported separately.

## Before / final page measurements

Values below are single laboratory samples, not p95. Improvements or regressions of a few milliseconds do not establish causality.

| Area | Device | LCP ms before → final | CLS before → final | TTFB ms before → final | Completed JS KB before → final | Local interaction ms final |
|---|---|---:|---:|---:|---:|---:|
| Homepage | mobile | 2660 → 4416 | 0.368 → 0.355 | 39.1 → 55.4 | 308.1 → 389.9 | 80 |
| The Beat | mobile | 1988 → 1932 | 0.541 → 0.541 | 38.3 → 47.1 | 283.1 → 283.9 | 72 |
| Film Room | mobile | 3184 → 3308 | 0.392 → 0.392 | 4.9 → 11.2 | 401.4 → 402.2 | 64 |
| Three & Out | mobile | 2460 → 2472 | 0.355 → 0.355 | 9.6 → 28.3 | 347.3 → 326.0 | 80 |
| The Huddle | mobile | 2988 → 2924 | 0.346 → 0.346 | 7.6 → 7.1 | 401.4 → 350.6 | 72 |
| AI Search | mobile | 2532 → 4140 | 0.355 → 0.355 | 6.1 → 7.7 | 301.5 → 387.2 | 64 |
| Front Office | mobile | 2472 → 2536 | 0.355 → 0.355 | 7.3 → 29.9 | 347.3 → 402.5 | 104 |
| Parlay Lab | mobile | 3108 → 3596 | 0.355 → 0.355 | 8.7 → 8.3 | 292.6 → 330.4 | 80 |
| Trending Props | mobile | 3620 → 3572 | 0.355 → 0.355 | 4.2 → 10.2 | 292.6 → 296.2 | 72 |
| Bet Slip | mobile | 1996 → 1984 | 0.355 → 0.355 | 5.8 → 13.7 | 309.4 → 311.0 | 80 |
| Profile | mobile | 1588 → 1592 | 0.000 → 0.000 | 21.4 → 29.3 | 177.4 → 167.2 | unmeasured |
| Homepage | desktop | 1560 → 1640 | 0.146 → 0.080 | 4.4 → 3.6 | 670.3 → 671.1 | unmeasured |
| The Beat | desktop | 396 → 392 | 0.009 → 0.008 | 14.8 → 9.5 | 653.6 → 699.6 | unmeasured |
| Film Room | desktop | 584 → 600 | 0.111 → 0.110 | 7.3 → 4.6 | 670.3 → 654.1 | unmeasured |
| Three & Out | desktop | 516 → 556 | 0.097 → 0.097 | 5.2 → 6.7 | 653.6 → 654.4 | unmeasured |
| The Huddle | desktop | 3408 → 1288 | 0.097 → 0.096 | 4.9 → 4.5 | 653.3 → 654.1 | unmeasured |
| AI Search | desktop | 1404 → 1404 | 0.080 → 0.080 | 4.7 → 5.4 | 653.3 → 654.1 | unmeasured |
| Front Office | desktop | 596 → 580 | 0.099 → 0.099 | 4.5 → 10.3 | 653.6 → 654.4 | unmeasured |
| Parlay Lab | desktop | 664 → 688 | 0.071 → 0.071 | 4.1 → 7.3 | 671.1 → 671.9 | unmeasured |
| Trending Props | desktop | 684 → 676 | 0.071 → 0.071 | 10.5 → 5.9 | 671.1 → 671.9 | unmeasured |
| Bet Slip | desktop | 444 → 440 | 0.055 → 0.055 | 4.1 → 4.3 | 716.1 → 671.9 | unmeasured |
| Profile | desktop | 368 → 376 | 0.000 → 0.000 | 12.4 → 8.1 | 242.4 → 243.1 | unmeasured |

The mobile LCP <1.5-s target is not generally met. CLS remains above 0.1 on some states; team preference/auth hydration and hero/content replacement still cause movement. These results do not establish exceptional page speed or a field INP guarantee. Further populated-fixture runs, repeated idle-host samples, low-end devices and hosted measurements are needed before attributing page improvements.

## Implemented optimizations and cache isolation

The web Worker forwarded `/api/*` to `API_SERVICE` before its cache code. The API Worker then forced every response to `private, no-store`, so the existing public cache path was bypassed. The API Worker now owns the public lookup after access middleware. A strict allowlist permits anonymous public team homepage/wire, Three & Out, Film Room, team metadata, public story details, events and bounded event-level research tables. Unknown/duplicate query parameters, private/auth/user/Front Office/saved-bet routes, cookies and authorization headers bypass it. Set-Cookie, private/no-store, errors and unsafe Vary responses cannot enter cache. Anonymous preview-gate failures retry the caller's authenticated transport outside shared caching, preserving private preview access.

Keys include normalized team/date/event/mode and `APP_CACHE_VERSION`; release/correction invalidation can advance that version. TTL is at most 30 seconds, honoring shorter research expiry before kickoff. Publication changes without a version bump can remain visible for that bounded TTL. Cache API entries are local to a Cloudflare data center, so one warm local benchmark is not a geographic hit-rate forecast. Review flags default off. No private data is publicly cached.

The native public client coalesces requests and keeps at most 32 one-MiB public responses for at most 15 seconds, respecting server max-age/Age/private/no-store. It sends no cookies or bearer tokens. Authenticated preview fallback is never stored. Failures are retried, teams use separate keys and account/private calls keep their original authenticated transport. Tests observed 20 concurrent public calls using one transport request. Native Home starts independent game metadata alongside editorial loading and uses a generation guard to reject late responses after team changes or unmounts. Web Home makes its public editorial/video reads anonymously with safe preview fallback; it still requests only the selected team.

No score formulas, sportsbook availability semantics, alternate-line filters, bet-slip state, refresh cadence or transaction behavior changed. Existing D1 ingestion precomputes model/context/board/reference-bound Lab Scores; reads reuse verified results. Existing progressive snapshots, request coalescing, pagination/grouping and bounded serialized filter pages were inspected and retained. The three-times-weekly odds cron remains **Mon/Wed/Sat 15:00 UTC** (`0 15 * * 1,3,6`). Broader per-market research recomputation and historical data hydration remain bottlenecks; no speculative virtualization dependency was added.

A lazy Film Room modal / deferred-request experiment did not demonstrate a bundle or mobile LCP win and was withdrawn. Initial route JS remains heavy, partly because global auth imports Front Office save-store logic. That synchronous owner-quarantine path was preserved rather than risk private state isolation. Existing Next image priority/sizes, local font loading and route splitting remain in place; no font improvement is claimed. Same-resolution quality-82 WebP stadium derivatives are now shared by web and native; KC's bundled native hero uses the derivative too. All original PNG URLs remain available. Measured assets across 32 teams fall from 95.69 MB to 13.45 MB (85.9%); see `stadium-assets.json` for exact bytes. KC and SEA original/derivative images were visually inspected with matching dimensions and composition. This measures transfer/package savings, not device startup. These are static assets, not additional R2 archives.

## Public API and database evidence

Actual local workerd, 30 sequential public event requests: cache hit rate **0.0% → 96.7%**; warm-sample p95 **4.56 → 5.23 ms**. First request is excluded from warm latency percentiles. The fixture has an empty precomputed event board; this is cache dispatch evidence, not populated large-response serialization. Logs show one D1 statement/read on MISS and **zero D1/R2 operations on HIT**. Cookie, bearer, private endpoint, unknown query and release-version invalidation tests pass. Hosted geographic p95 <100 ms remains unverified.

D1 upcoming-event lookup previously used `WHERE ?=1 OR kickoff_at>?`, forcing a scan of the existing kickoff index. Splitting the include-history and upcoming queries enables an indexed range search. The 10,000-event fixture returns identical original 16 rows with **10,000 → 16 row reads (99.84% fewer)**, zero writes and no new index bytes. Local SQLite duration was 1 → 0 ms at coarse timer resolution; this is not a stable latency claim. Existing owner/team/board indexes were inspected; no speculative indexes were added. New notification indexes support a newly ported domain and are included in staging's unmodeled-volume caution.

## Initial route bundle sizes

Raw production manifests, gzipped each initial JS file independently; async/prefetch transfers are excluded. This work does not claim a broad bundle reduction.

| Route manifest | Before gzip KB | Final gzip KB | Delta bytes |
|---|---:|---:|---:|
| `/page` | 243.92 | 244.70 | +775 |
| `/the-beat/page` | 244.63 | 244.64 | +7 |
| `/watch/page` | 244.63 | 244.64 | +7 |
| `/three-and-out/page` | 244.63 | 244.64 | +7 |
| `/huddle/page` | 200.59 | 200.62 | +29 |
| `/front-office/page` | 244.63 | 244.64 | +7 |
| `/parlay-lab/page` | 245.22 | 245.22 | +3 |
| `/parlay-lab/my-plays/page` | 190.84 | 190.85 | +5 |
| `/account/[section]/page` | 194.02 | 194.02 | +2 |

## Native and regression validation

Expo SDK 54 versioned documentation and the existing mobile-web/native components were inspected. Native TypeScript passes. Offline Expo Android, iOS and web bundles export successfully (`native-export-final.log`); symlinked dependency resolution in Metro was corrected for isolated worktrees. These are JavaScript build artifacts, **not device installs or native startup/transition performance measurements**. Android/iOS visual/device validation remains unverified; no React Native screen was replaced with a WebView.

Final application/Worker/database/password/SQLite tests: **1199 passed, zero final failures**. The two conditional unit skips pass in dedicated integrations. **48** browser cases cover KC/SEA at mobile/desktop widths, navigation, auth/reset/verification, saved-content owner isolation and restart durability. **58** split Worker HTTP samples plus the actual password/reset/session probe pass. Corruption and complete synthetic incremental restore pass. Full PostgreSQL migration replay remains blocked by missing local pgvector, separately documented in staging readiness.

## Infrastructure impact and remaining work

The public cache uses the existing Cache API and adds no D1 storage, writes or paid dependency. The event query adds no index and reduces measured reads. Public client caches use bounded memory; private-preview fallback can require an extra anonymous request before the authenticated attempt. No account-wide traffic/hit rate or no-cost whole-product guarantee is inferred. The private password service and new notification domain belong to staging work and still require hosted CPU/volume qualification.

R2/D1/account constraints remain: 365-day D1 829.4 MB, R2 payload floor 7.48 GB, optimistic retained recovery footprint 8.74 GB, unknown domain volumes and existing 19.06M Class B/month lower bound. Those do not meet the 30% headroom target. No infrastructure was activated or billed by this work. See `STAGING_READINESS_REPORT.md` for recovery and full-product staging blockers.

Next work: remove heavy save-store dependencies from global auth through a separately tested synchronous ownership boundary; provide server-known team branding to reduce hydration shifts; measure populated public/Parlay data under repeated cold/warm samples; qualify private/profile/Front Office queries and remaining PostgreSQL domains; run real low-end Android/iOS profiling and hosted Worker CPU/geographic traces after review approval.

References: [Cloudflare Cache API behavior](https://developers.cloudflare.com/workers/reference/how-the-cache-works/), [R2 free tier](https://developers.cloudflare.com/r2/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Expo SDK 54 archived source](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/index.mdx).
