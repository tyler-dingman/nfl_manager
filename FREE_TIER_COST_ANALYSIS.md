# Down & Distance: free-tier cost analysis

As of October 16, 2026. USD; decimal GB/MB unless stated otherwise; 30-day modeling month. Provider documentation checked during this audit. Limits below are published terms, not verification of this account's effective plan, remaining allowance or billing controls. See [audit evidence](ARCHITECTURE_AUDIT.md).

## Conclusion

**$0/month is a conditional launch target, not a verified production total.** A small, cached D1 editorial workload appears to fit published daily row/operation quotas under the assumptions below. The existing whole application is not yet qualified: production PostgreSQL rejected a read-only connection with quota error `53000`; recurring delivery can prevent Neon suspension; frontend hosting eligibility is unresolved; and Worker Free CPU can reject the existing processing logic even when row counts are low.

Recommend: baseline → public caching and scheduling fairness → bounded D1/Worker qualification → hybrid cutover only after gates pass. If Neon plus caching meets the measured requirements, it is the simpler launch option. Do not migrate merely to obtain a larger advertised account storage number.

## Verified, historical and estimated usage

| Evidence                                                                                    | Date / scope                                 | What it proves                                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Local `pg_database_size` 528,515,875 bytes                                                  | Current audit, local only                    | Local PostgreSQL footprint; not production/project billed storage                                 |
| Local markets/current prices/history 481.0 MB combined                                      | Current audit, local only                    | Non-editorial data can dominate storage after a D1 move                                           |
| Production read-only attempt: `53000`                                                       | Current audit                                | Production endpoint unavailable due to quota; does not identify which provider meter is exhausted |
| 120 monitoring definitions, 97 credential-free RSS; 66 verified video definitions; 32 teams | Current offline code evaluation              | Configured source universe; not live reachability or account usage                                |
| 151,838,720 production DB bytes                                                             | September 17 report                          | Historical single-database size, not today's project total                                        |
| 6.46 GB over roughly 23 days                                                                | September 27 report, reported provider usage | Historical approximately 281 MB/day; code attribution not established                             |
| Eight Worker cron runs/day; five-minute delivery workflow                                   | Current checked-in files                     | Intended schedules; today's live execution counts unknown                                         |
| All traffic, body sizes, cache ratios, D1/Queue/CPU forecasts below                         | Planning scenarios                           | Inputs for qualification, not measured production consumption                                     |

No current account-wide Neon/Cloudflare/Vercel meters, billing plan, Google usage or external provider invoice was retrieved. Prior September reports are evidence with their original dates, not a substitute for current telemetry.

## Current published free allowances

| Service                   | Published allowance relevant to this app                                                                                                                         | Main caveat / primary source                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon Free                 | 100 CU-hours/project/month, 5 GB public transfer/project/month; **current pricing page says 1 GB storage/project**; inactive compute suspends after five minutes | Prior reports/docs quoted 0.5 GB. Verify this project's effective quota; use 0.5 GB conservatively until confirmed. Branches/endpoints share project resources. [Neon pricing](https://neon.com/pricing) |
| Workers Free              | 100,000 requests/day, 10 ms CPU/invocation, 128 MB memory, 50 subrequests/invocation, five cron expressions/account                                              | CPU applies to processing, not network wait; a long cron interval does not grant Free a paid CPU allowance. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)                 |
| D1 Free                   | 5 million rows read/day, 100,000 rows written/day, 5 GB aggregate storage                                                                                        | Meter scanned/index rows, not returned rows; index changes add writes. Quota exhaustion blocks queries. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                             |
| D1 Free structural limits | **500 MB per database**, ten databases/account, 2 MB maximum row/string/blob, 100 bound parameters/query, 50 queries/Free invocation; seven-day Time Travel      | Do not assume 5 GB fits one database. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)                                                                                                 |
| Queues Free               | 10,000 operations/day; 24-hour retention                                                                                                                         | Ordinarily three operations/message, with extra reads on retry; batching does not remove per-message charges. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)               |
| R2 Standard               | 10 GB-month storage, 1 million Class A and 10 million Class B operations/month, free direct egress                                                               | Standard only; overages can bill. A free allowance is not a guaranteed spending cap. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)                                                         |
| Workers Logs              | 200,000 events/day, three-day retention under the currently published schedule                                                                                   | Pricing changes December 1, 2026; recheck before that date. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)                                                   |
| Vercel Hobby              | 1 million function invocations, four active CPU-hours, 360 GB-hours memory, 100 GB fast transfer and 10 GB origin transfer                                       | Personal/noncommercial restriction. A commercial application cannot assume eligibility even below resource limits. [Hobby terms and allowances](https://vercel.com/docs/plans/hobby)                     |
| GitHub Actions            | Standard hosted runner usage is free for public repositories                                                                                                     | Repository visibility and runner type must be reverified; private Free accounts have limited minutes. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)      |

Daily quotas and monthly quotas are different constraints: unused daily D1/Queue capacity does not justify a burst tomorrow. Reserve account headroom for other Workers, development, shadow reads, imports and retries. Use UTC-reset budgets where documented, not a Chicago calendar counter.

### Hosting gate

The app includes commerce, native Node Argon2, filesystem/static-data use and Node-specific modules. Moving the content engine does not qualify the remaining Next.js application for Cloudflare Free hosting. Keep the current host during a separately authorized content migration only if its actual plan and use are eligible. For a commercial $0 launch, a later compatibility spike must prove a commercially permitted free host can run the remaining API/auth/SSR workloads within limits; otherwise $0 and unchanged full functionality cannot both be certified. Do not silently change auth algorithms, remove commerce, or introduce a paid host to close this gap.

## Baseline workload model

These are **assumptions**, deliberately explicit and replaceable:

- 97 RSS definitions × eight checks/day = 776 fetches/day.
- 66 video definitions × four checks/day = 264 fetches/day.
- Total source fetches: **1,040/day**; canonical URL/channel dedupe may lower it, paging/retries may raise it.
- 200 new/revised text candidates plus 40 video records/day; 80 changed story versions/day; up to 32 edition jobs/day and 128 grouped integration/projection jobs/day.
- Queue messages: `1,040 + 200 + 32 + 128 = 1,400/day`, assuming one bounded source job also parses/persists its small result. Videos do not create Beat candidate-generation jobs. If CPU requires extra steps/messages, recalculate before enabling.
- 20,000 public editorial requests/day; 90% aggregate cache hit ratio across real regions/instances/parameter variants; **2,000 origin reads/day**. This is an optimistic testable input, not an edge-cache guarantee.
- 150 D1 metered rows/origin API read on average; full catalogs/search may be much larger. No user/account requests included in these public-content counts.
- Small Queue messages below 64 KB, 25% operation reserve for retries/transport overhead.

### D1 reads and writes

| Component                                           | Assumed calculation             | Daily metered estimate |
| --------------------------------------------------- | ------------------------------- | ---------------------: |
| Public reads                                        | 2,000 misses × 150 rows         |          300,000 reads |
| Clustering/evidence                                 | 200 candidates × 500 rows       |          100,000 reads |
| Source/claim reads                                  | 1,040 source jobs × 30 rows     |           31,200 reads |
| Other projections, editions, maintenance and margin | Budget allocation; must measure |          168,800 reads |
| **Total reads**                                     | Scenario allowance              |        **600,000/day** |
| Job state/indices                                   | 1,400 jobs × 12 writes          |          16,800 writes |
| Source health/indices                               | 1,040 checks × five writes      |           5,200 writes |
| Candidates/associations/indices                     | 240 × 12 writes                 |           2,880 writes |
| Stories/evidence/versions/events/indices            | 80 × 35 writes                  |           2,800 writes |
| Integration/projection maintenance                  | 160 × eight writes              |           1,280 writes |
| Cleanup, retries and other write margin             | Budget allocation               |           5,000 writes |
| **Total writes**                                    | Scenario allowance              |         **33,960/day** |

These amplification factors already intend to include indexes, but are guesses. Capture actual `meta.rows_read`/`rows_written` for every representative statement/batch. A returned page of 20 stories can scan thousands of rows. A 10,000-row scan × 2,000 cache misses is **20 million reads/day**, four times the free allowance, despite small JSON pages. Indexes, search and full Film Room catalogs must be qualified individually. See [D1 metering](https://developers.cloudflare.com/d1/platform/pricing/).

### Queue and Worker budgets

`1,400 × 3 × 1.25 = 5,250 Queue operations/day`, below 10,000 and the proposed 8,000 operational ceiling. At this retry reserve, 8,000 ops allows approximately **2,133 messages/day**. An extra parse job for every source would add 1,040 messages and raise the model to **9,150 operations/day**: still below the advertised limit, but it fails the recommended launch headroom gate. A design needing that extra stage must change its measured cadence/message design or remain on the existing backend; do not assume queue micro-batching is free.

Rough Worker invocation model: 20,000 public requests + 1,440 one-minute cron ticks + 1,750 job deliveries including 25% retry allowance + approximately 128 bridge/control calls = **23,318/day**, round up to 24,000. Count all cache hits as Worker invocations when using the Cache API; do not subtract them. Multi-stage consumers and old scheduler traffic add usage. This is quota headroom only, **not CPU qualification**.

Target p99 CPU below **8 ms** for every enabled Free handler, with no observed limit failures on representative largest inputs and adversarial valid filters. Feed parsing, regex/entity matching, broad clustering and full-response serialization can exceed 10 ms. Benchmark deployed Free, not only local wall time; paid Queue CPU examples are not permission to assume Free has 30 seconds. If splitting steps breaks Queue/headroom limits, the proposed engine does not yet satisfy $0.

## Storage growth

Illustrative uncompressed logical growth per day:

| Data                               | Assumption     |      Growth/day |
| ---------------------------------- | -------------- | --------------: |
| Candidates including raw text      | 240 × 8 KB     |         1.92 MB |
| Story versions and changed content | 80 × 12 KB     |         0.96 MB |
| Job ledger payload/state           | 1,400 × 0.5 KB |         0.70 MB |
| Editions                           | 32 × 10 KB     |         0.32 MB |
| **Before other tables/indexes**    | Sum            | **3.90 MB/day** |

At an illustrative 1.5× storage amplification, that is **175.5 MB/30 days** and **526.5 MB/90 days**, plus initial import and existing stories. Thus one D1 Free database can fill in under 90 days without approved compaction/archive even for this modest scenario. Real SQLite page/index size and raw-text distributions must replace these assumptions. Larger bodies or index-heavy JSON duplication worsen the forecast.

Use 350 MB operating target and stop new bulk imports at 400 MB. Retain public IDs/editions and saved-content resolution; archival needs a tested retrieval adapter. No data deletion was authorized. Moving the local odds/history footprint to D1 would be inappropriate and would nearly fill one Free database before editorial growth.

R2 illustration if enabled: one 100 KB owned asset per changed story gives 8 MB/day, 240 MB/month and about 2,400 PUTs/month; 20,000 uncached asset GETs/day adds 600,000 Class B/month. Both fit published allowances in isolation, but archives/backups/retries/other buckets count too. For a strict no-billing launch, keep optional R2 disabled until effective billing protections and application budgets are agreed; existing repo assets can remain. Do not cache unlicensed media merely to reduce transfer.

## Compare the three architectures

Use the same launch traffic/cadence for comparisons; current default batching does **not** already provide that full coverage.

| Dimension                                   | Existing Neon content architecture                                                   | Neon plus public caching                                                | Hybrid Neon + D1 + public cache                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Content storage                             | PG bodies, evidence, jobs and user data share project                                | Same                                                                    | Editorial graph isolated, extra D1/bridge/derived-index storage                                        |
| Ingestion reads/writes                      | Repeated recent clusters/evidence and registry updates                               | Essentially unchanged unless separately optimized                       | Shift to D1 row quotas; fair scheduling and hash updates required                                      |
| Example public DB transfer                  | 20,000 requests × 30 KB database result × 30 = **18 GB/month**                       | At 90% hits: **1.8 GB/month**                                           | Editorial result transfer no longer leaves Neon; bridge/search/reference bytes remain                  |
| Ingestion transfer assumption               | 200 candidates/day × 500 rows × 0.5 KB × 30 = **1.5 GB/month**, excluding other work | Same                                                                    | Served within D1; still count rows scanned                                                             |
| Transactional user transfer assumption      | **0.5 GB/month** for comparison only                                                 | Same                                                                    | Same; unchanged user traffic can dominate later                                                        |
| Modeled transfer subtotal                   | **20 GB/month**                                                                      | **3.8 GB/month**                                                        | Example **0.8 GB/month** if changed bridge/search/reference traffic adds 0.3 GB to 0.5 GB user traffic |
| Neon compute with five-minute delivery kept | Could approach **180 CU-hours/month** at 0.25 CU                                     | Same wakeup problem                                                     | Same wakeup problem unless delivery scheduling changes                                                 |
| Complexity                                  | Lowest                                                                               | Low/moderate cache key and invalidation work                            | Higher: two stores, outbox, migration, conflict/replay/rollback                                        |
| Conditional infra fee                       | $0 only if actual quotas/host eligibility pass; above example transfer fails         | Potential $0 after compute/host gates; cache example transfer fits 5 GB | Potential $0 after all gates; not automatically lower than caching                                     |

Database-result sizes in this table are assumed **wire result bytes**, not page weight or local relation size. The 0.3 GB bridge assumption needs measurement of full article search deltas and notification fanout; migration copy is additional, not included. This table is not a claim of a measured percentage saving.

Historical 281 MB/day extrapolates to 8.43 GB/30 days, above the published 5 GB transfer allowance; no causal attribution or expected post-migration reduction can be certified from that history alone.

### Neon compute scenarios

At the default minimum assumed 0.25 CU:

- One continuously awake endpoint: `0.25 × 24 × 30 = 180 CU-hours/month`; above 100 free CU-hours. Autoscaling or additional endpoints increase it.
- Eight non-overlapping daily bursts of one active minute + five idle minutes: `8 × 6/60 × 0.25 × 30 = 6 CU-hours/month`, ingestion-only.
- Twenty grouped daily application/delivery/bridge wake windows averaging six minutes: **15 CU-hours/month**. This is a low-traffic hybrid scenario, not a forecast; user requests can extend those windows.
- At 0.25 CU, 100 CU-hours permits 400 awake hours/month (about 13.3 hours/day). Proposed 80 CU-hour headroom allows about 10.7 hours/day. Continuous foreground usage/polling can exceed it without any content ingestion.

Wake intervals overlap, so do not add these scenarios as independent billed totals. The five-minute delivery workflow may keep the endpoint awake all day, even if responses are cached publicly. The next-due control signal in the target design is necessary to remove idle polling without changing user-selected delivery timing. It is not implemented here.

## Sensitivity / stress cases

| Scenario                                                            | Consequence                                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache hit ratio drops from 90% to 50% at 20,000 public requests/day | Public D1 reads rise from 0.3M to 1.5M/day at 150 rows/miss; Neon cached public transfer would rise from 1.8 GB to 9 GB/month.                     |
| 100,000 public Worker requests/day                                  | Exceeds the request allowance once cron/jobs are included, even if every public response is a cache hit.                                           |
| Busy day: 800 text + 160 videos + 320 changed stories/day           | Recalculate write amplification/storage and candidate stages; per-team fairness and 320 generation reservation matter. No automatic paid overflow. |
| Broad query scans 10,000 rows/miss                                  | Full-scan example above exceeds D1 daily reads. Rate limits or indexes alone do not prove semantics/performance.                                   |
| Queue processing split into extra stages                            | 9,150 ops/day example fails headroom before traffic growth.                                                                                        |
| Import/shadow reads during launch                                   | Eats Neon egress and D1 rows/writes in addition to normal workload; schedule and reserve explicitly.                                               |
| All sources return large feeds after outage                         | CPU/serialization limits, retry storm and daily row budget may fail together; durable checkpoints and controlled catch-up required.                |

## External AI and data costs: separate ledger

| Provider/work                           | Current code behavior                                                                                        | Launch cost/control                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled story synthesis               | Explicit grounded deterministic engine                                                                       | **$0 external inference** for that path; Worker compute still metered.                                                                                                                                                                                                                                        |
| Optional OpenAI topic summarizer        | Existing HTTP adapter selected by provider/model/key; legacy detail GET can reach it on a cache miss         | Potential paid token usage, unknown model/rate/usage. Keep disabled for $0; no model pricing assumption or service activation.                                                                                                                                                                                |
| Ollama                                  | Loopback-only content provider, default qwen3:4b-instruct                                                    | No API fee on operator hardware; electricity/hardware/hosted inference is outside the $0 claim. Cannot run local model inside Worker.                                                                                                                                                                         |
| Search embeddings/answers/transcription | Configurable BGE HTTP endpoint, Ollama answer model, Whisper endpoint; scheduled embeddings explicitly false | Endpoint hosting/API cost unknown; preserve deterministic/lexical behavior, do not silently claim hosted AI/transcription is free.                                                                                                                                                                            |
| YouTube Data API                        | Upload playlists; curated metadata/oEmbed                                                                    | Model ~264 uploads + up to 100 metadata calls/day before retries, below 10,000 daily non-search units if sole project consumer. Current Google docs list separate search/upload buckets; dashboard effective quotas unknown. [Google quotas](https://developers.google.com/youtube/data/determine_quota_cost) |
| SportsGameOdds                          | Manual imports, stored prices for app reads; existing local allowance guard                                  | Published Amateur: 2,500 objects/month, ten requests/minute. Historical 101-object reading is stale. Preserve serialized imports and app ceiling; no recurring all-team odds polling. [Provider limits](https://sportsgameodds.com/docs/info/rate-limiting)                                                   |
| Unabated sportsbook transfer            | Existing durable transfer adapter and enable flags                                                           | Partner contract and API cost unknown; 50-generation config caps are not dollar guarantees. No test generation/live odds requests during audit.                                                                                                                                                               |
| X / Reddit / gated scraping             | Definitions do not establish active adapters or free production rights                                       | Disabled until credentials, terms and price are verified; no new paid source assumed.                                                                                                                                                                                                                         |
| ESPN / NFLverse / other reference feeds | Public retrieval/import code                                                                                 | No fee configured in repo; availability, rate limits and usage rights not a guaranteed SLA or unlimited allowance.                                                                                                                                                                                            |
| Expo / browser push                     | Existing delivery channels                                                                                   | Expo push has no service fee; app-store/EAS build/update fees are separate. [Expo FAQ](https://docs.expo.dev/push-notifications/faq/)                                                                                                                                                                         |
| Email/SMS, commerce, domain, app stores | Configurable/not fully implemented messaging adapters; Stripe/merch integrations                             | Provider subscriptions/messages, payment fees, fulfillment, domain renewals and store enrollment are outside this infrastructure scenario; verify actual invoices. Do not count them as $0.                                                                                                                   |

No video downloading, paid transcript analysis, AI image generation or Workers AI service is required by the proposed launch engine. If these become required functionality, budget them explicitly rather than hiding them in infrastructure.

## Monitoring, guardrails and launch gates

Proposed application thresholds, not installed or guaranteed provider hard spending caps:

| Meter           | Warning / qualification target                    | Pause or stop condition                                                       |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Neon transfer   | Projected <4 GB/month                             | No bulk sync when projected >4 GB or remaining quota is insufficient          |
| Neon compute    | Projected <80 CU-hours/month                      | Investigate wakeups; no new scheduled load if projected >80                   |
| Neon storage    | <80% effective project allowance                  | No unapproved retention delete; require archive/storage decision              |
| D1              | <3.5M reads and <70k writes/day                   | Pause nonessential jobs by 4M reads/80k writes; leave read headroom           |
| D1 storage      | <350 MB with 90-day forecast                      | Stop bulk imports at 400 MB; published/user-linked data never silently purged |
| Worker requests | <70k/day projected                                | Throttle optional endpoints/work at 80k; bot/abuse protection needed          |
| Worker CPU      | p99 <8 ms, tested worst valid workloads           | Any repeated runtime limit failure blocks cutover                             |
| Queues          | <7k operations/day projected                      | Stop optional dispatch at 8k; never treat batch as one operation              |
| R2 optional     | <8 GB, 0.8M Class A, 8M Class B/month             | Upload/optional asset fetch budgets fail closed before free allowance         |
| Google metadata | Application reserve below effective project quota | Stop optional refresh and use stored metadata when reserve low                |

Meter counters need conservative atomic reservation, reconciliation with provider totals and account-wide headroom. Local counters cannot see other scripts/accounts and are not a substitute for provider limits. Prefer Free plans that stop at quota; R2 and any existing paid plan require explicit overage controls or remain disabled. Do not add paid upgrades automatically.

Launch qualification requires seven representative days plus a busy-game-day replay, real Free Worker CPU/row metrics, production contract parity, current plan/host eligibility and a projected month below thresholds. A $0 budget entails a potential availability/freshness ceiling under quota exhaustion; no plan can guarantee arbitrary load, unchanged service levels and zero spend simultaneously.
