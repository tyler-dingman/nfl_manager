# Durable batched polling capacity qualification

2026-10-19. Baseline: `poc/content-engine-free-optimization`, `7aaec5b2`. Implementation: isolated worktree `/private/tmp/down-distance-staging-preparation`, branch `poc/durable-batched-polling`.

**Local daily-operation qualification: PASS at 50 assumed DAU. Deployment readiness: NOT established.** Hosted Worker CPU, live providers, mature history, and actual account headroom remain unverified. No deployment, remote resource creation, billing activation, production access, PostgreSQL, or R2 was used.

## Required results

| Result | Before | After |
| --- | ---: | ---: |
| Daily writes, content engine plus recovery preparation/cleanup | 343,972 | **64,664** |
| Polling and candidate-enqueue writes | 334,704 | **54,912** |
| Daily reads, including recovery preparation/cleanup | 570,606 | 767,714 |
| Maximum measured content invocation queries | 39 | **47** |
| Maximum polling invocation queries | 31 | **34** |
| Article correction invocation queries | 28 | 28 |
| Measured core HTTP fixture calls | 24,521 | 11,369 |
| Physical D1 bytes after cleanup | 10,309,632 | 5,029,888 |
| One-day physical growth | 8,069,120 | 2,777,088 |
| Encoded immutable payload bytes | 1,584,622 | 1,584,595 |
| Encrypted complete offline archive bytes | 11,277,916 | 4,081,444 |

Daily writes fell 81.2%; polling writes fell 83.6%. Reads increased 34.5%, principally from durable due selection and the newly included 1,440 empty candidate scheduler invocations. At 50 DAU the model uses **68,714 writes/day**, leaving **31,286 writes/day (31.3%)** below the shared 100,000 allowance and 1,286 below the 70,000 planning target. This margin does not qualify an unspecified seasonal burst or notification workload.

Maximum Worker queries: **47**, below 50. The desirable sub-30 target is met by corrections and ordinary empty batches, but not by cold publication with automation accounting, some new-feed batches, or odds publication. These exceptions are reported rather than counted as one query per SQL batch. Every final replay HTTP invocation had an enforced 50-statement budget; no invocation exceeded it. Owner-only export/restore/GC comprises many separate local calls and is explicitly outside that per-HTTP measurement.

## Why the previous lifecycle failed

Each ordinary source check created a durable SOURCE_FETCH job, claimed it, updated its source checkpoint, and completed its job. The four business mutations, indexed changes, and maintenance-fence guards accounted for 18 D1 rows written per check: 18,504 × 18 = 333,072 rows/day, before 96 candidate inserts/enqueues contributed another 1,632 rows. These were real D1 metadata counters, not an estimate based on statement count. Completed poll jobs also accumulated in storage.

No feed interval reduction or index removal could safely eliminate that lifecycle cost. The new protocol removes those per-check jobs while retaining their necessary durable ownership and recovery responsibilities at batch scope.

## Implemented protocol

Additive migration `0045_poll_batches.sql` introduces two operational tables. `app_storage_poll_batch` holds one globally serialized, expiring lease and a compact manifest. `app_storage_poll_retry` holds original pending or failed feed items per source, separate from the manifest. It is both an inbox and retry store, not an archive. Each inline source inbox is bounded at 1,900,000 encoded bytes, below D1's row limit. The existing RSS fetcher already limits an upstream response to 1 MiB. Inputs beyond supported bounds fail closed without advancing validators or checkpoints; operators must resolve those errors rather than discard the feed.

1. A read-only due/busy preflight avoids writes on idle scheduler ticks. An atomic INSERT/conditional UPSERT acquires a unique 120-second lease for at most eight due sources, ordered by existing priority, next check time, and ID. The SQL arbitrates races; the preflight is only a hint.
2. Definitions are prefetched together. At most eight independent, sequential fetches use the existing source fetchers, allowlists, redirect checks, ETag/Last-Modified conditional requests, and timeouts. Sequential fetching avoids exceeding six simultaneous connection openings. A fetch failure becomes a result with normal exponential backoff while other sources continue.
3. Known candidate URLs and retention receipts are checked in bulk. Missing processing jobs for already-saved NEW candidates are repaired idempotently. URL comparisons use the existing application canonicalization (including tracking parameters); stable source/external IDs also repair candidate-job retries when a feed URL changes. Unchanged/duplicate-only batches commit immediately.
4. New feed items enter per-source inboxes in the same ownership-conditioned transaction as the lease manifest. Multiple simultaneous large feeds therefore do not have to fit in one SQLite row. Only a manifest is stored in the lease.
5. Each continuation processes **one original feed item** through the existing normalization, filtering, candidate persistence, and durable candidate-job code. A checkpoint is deferred until that batch is settled. Cursor/inbox progress and lease extension commit together. Replaying an ambiguous save repairs the job before acknowledging the item.
6. One bounded transaction updates all completed source checkpoints, saves any failed processing evidence, clears completed inboxes, and releases the lease. The source's indexed due metadata still costs two accounted writes per source; maintenance-fence overhead is shared across the transaction. An ordinary full eight-source empty batch costs 22 writes, about 2.75/check, instead of 144 writes under the old lifecycle.
7. Token and expiration predicates protect every inbox/checkpoint mutation. An expired worker cannot release or overwrite a replacement owner's state. Uncommitted fetches may be fetched again; committed inboxes survive lease expiry and actual workerd restart.

Durable jobs remain for new candidates. Existing SOURCE_FETCH jobs and all original IDs/history are retained and can still drain. A canonical commit guard additionally prevents the same candidate from becoming evidence for two distinct canonical articles if stale candidate processors race. Publication, evidence, FTS, versions, and outbox remain atomic.

The new operational tables contain inline feed data, IDs, and cursors, not new immutable-object hashes. They fall under the existing `app_storage_` operational schema contract; no immutable GC root whitelist was weakened. Full frozen-table backup/restore includes them. Pending inbox data is never subject to an automatic TTL deletion.

## Scheduler and preparation

The authenticated global and KC trial D1 automation routes use `action=poll` and `action=candidate` with explicit batch continuations. Trial time windows and generation limits remain checked. PostgreSQL orchestration remains for rollback. D1 `scheduleDueSources` returns a batch token rather than enqueueing SOURCE_FETCH jobs; legacy owner scripts must consume that token or use the bounded HTTP runner. They are not evidence of a completed batch merely because a scheduling call succeeded.

The shared continuation runner accepts only known actions and opaque tokens, never a server-supplied destination URL. It is bounded at 32 API calls for the standalone scheduler/owner HTTP runner. The application service-binding scheduler caps its continuation chain at 16, keeping its worst-case nested D1 calls below the 1,000 internal-service subrequest allowance even at 50 queries per child request. A capped or interrupted runner leaves durable work for recovery rather than promising completion. Candidate and poll idle paths perform **zero writes**, verified by metadata tests and all 1,440 measured empty candidate invocations.

Registry synchronization is no longer an all-source mutation inside every scheduler request. The authenticated global route supports `action=registry&cursor=N`, reconciling one code-defined source per call. The actual local Worker preflight verified **120 source definitions, 97 enabled RSS sources, maximum 14 queries/call**. Run all registry continuations before starting a newly created database and after source definition changes. This setup must be verified explicitly; an idle polling response by itself is not proof of a populated registry.

Example sequence against an **already running isolated local** no-billing Worker, with a synthetic automation secret:

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --local --config wrangler.api-no-billing-local.toml --persist-to /private/tmp/dd-polling-review
curl --fail --request POST --header "Authorization: Bearer $CONTENT_AUTOMATION_SECRET" 'http://127.0.0.1:8787/api/automation/content/global?action=registry&cursor=0'
# Follow nextCursor through null; each call reconciles exactly one source.
curl --fail --request POST --header "Authorization: Bearer $CONTENT_AUTOMATION_SECRET" 'http://127.0.0.1:8787/api/automation/content/global?action=poll&group=standard'
# Follow batch token with action=poll, then action=candidate until idle.
```

The supported HTTPS owner runner `scripts/content-ingestion-request.mjs` follows those bounded continuations after authentication preflight. `complete:false` means more work remains; it is not an ingestion completion certificate. Restarting without the previous token can wait until the 120-second lease expires. Cold bootstrap or a large provider burst can require several bounded ticks; the ideal-clock replay does not measure this wall-clock backlog.

The old eight-times-daily scheduler could not maintain five-minute source freshness. The isolated scheduler configuration now has **`crons = []`**. A one-minute dispatch is documented as a proposal only. The application handler accepts that content tick while retaining half-hour briefing/maintenance scheduling. No production Cron Trigger was enabled. The Mon/Wed/Sat Parlay Lab odds schedule was unchanged.

## Complete 24-hour workload

Evidence: `reports/batched-polling-capacity/qualified/day-after.json` and its complete request ledger. Baseline evidence is the committed `reports/content-engine-capacity/day-after.json` at `7aaec5b2`; no previous result was rewritten.

- All 32 teams, all 97 enabled RSS sources, **18,504 checks**: 32 sources × 288, 64 × 144, and one × 72. Final durable per-source request counts match this distribution exactly. All final failure counters are zero and no inbox remains pending.
- The configured 300/600/1200-second source intervals, priorities, and attribution are preserved. Virtual-clock checks occur at those scheduled times. Live network latency, capped scheduler cold-start catch-up, and real provider freshness are not measured.
- 96 new candidates create 96 canonical stories, then 96 corrections leave every original story at version 2. Repeated hourly source items exercise duplicate suppression. No additional story is published from those revisits.
- 32 Three & Out briefings; actual Monday refresh slot with 16 events × 2,000 markets; real Lab Score computation and durable precomputed results. No odds cadence change. The fixture's historical research reference set is empty, as in the baseline; this is an explicit coverage gap.
- Registry reconciliation every 30 minutes, 1,440 minute-by-minute idle candidate API invocations, normal poll idle invocations, approved retention boundary fixtures, encrypted full backup, complete verified restore, and only then retention/GC.
- Source/candidate/editorial operations use actual adapters/services. The final candidate path invokes the authenticated bounded global route inside workerd. External RSS responses are synthetic injections; no live providers are called. Polling uses the same bounded protocol class under an actual local HTTP boundary and query instrumentation.
- Full-day fault count is zero. Failure/retry behavior is tested separately; fault-test mutations are not silently mixed into the normal-day baseline. Notification fanout is suppressed by observer mode, matching the established baseline.

| Subsystem | Calls | Reads | Accounted writes | Max queries |
| --- | ---: | ---: | ---: | ---: |
| Registry | 5,761 | 18,002 | 1,082 | 14 |
| Polling, inboxes, candidate enqueue | 3,912 | 543,228 | 54,912 | 34 |
| Canonical processing plus real automation accounting | 96 | 34,513 | 4,805 | 47 |
| Empty candidate scheduler calls | 1,440 | 146,880 | 0 | 3 |
| Corrections | 96 | 5,859 | 2,977 | 28 |
| Odds | 16 | 448 | 416 | 36 |
| Lab Scores | 16 | 294 | 112 | 19 |
| Three & Out | 32 | 288 | 320 | 11 |
| Owner recovery preparation | many owner calls | 13,641 | 8 | not one HTTP invocation |
| Verified retention and GC | bounded steps plus owner sweep | 4,561 | 32 | owner sweep excluded |

The metadata includes indexed writes and maintenance guard rows. It is not a physical disk-write/CPU measurement. Business mutations, index entries, and statement counts remain different units; no SQL batch is counted as a single statement. The additional automation-accounting cost is deliberately included after the change, making the comparison more conservative than omitting it from both sides.

## Capacity model

`capacity.json` is generated by `scripts/project-batched-polling-capacity.py`. User activity frequencies are assumptions; unit costs come from successful local Worker browser/auth HTTP traces. Per DAU/day: four auth reads, two logins/logouts, 0.1 signup, four home reads, two saved-content reads and one mutation, 0.2 preference updates, 0.5 Front Office creates, and two content-state writes. This is not 50 real users observed in production.

| Assumed DAU | Daily reads | Daily writes | Writes remaining of 100,000 | Worker requests including 1,440 proposed trigger invocations | Under 70,000 target |
| --- | ---: | ---: | ---: | ---: | --- |
| 0 | 767,714 | 64,664 | 35,336 | 12,815 | YES |
| 25 | 771,357 | 66,689 | 33,311 | 13,260 | YES |
| 50 | 774,999 | **68,714** | **31,286** | 13,705 | **YES** |
| 100 | 782,284 | 72,764 | 27,236 | 14,595 | NO; below hard write allowance only |

Official limits were checked against [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). The model uses shared account quotas of 5 million reads and 100,000 writes/day, not an allowance per database. Workers Free has 100,000 requests/day and a 10 ms CPU allowance; local wall time is not CPU evidence. D1 Free's 50-query invocation bound and per-row/storage limits still apply. Actual account availability was not inspected.

The full synthetic restore to a separate local target measured 7,345 additional reads and 7,171 writes. These are excluded from ordinary source-account totals because the verification target was local. A future remote disaster restore consumes additional quota and must be planned with ingestion paused. Two owner-managed encrypted archive copies consume 8,162,888 offline bytes for this day; no Cloud storage was introduced. This is a one-day dataset, not a multi-year database or backup projection.

## Failure, recovery, and regression validation

The new tests verify:

- Duplicate scheduler claim: exactly one owner; idle claim/empty candidate claim cause zero writes.
- Termination before a checkpoint: expired token rejected and replacement lease can retry safely.
- Source timeout: other sources finish; failure backoff, counters, and original validators remain correct.
- Partial processing: only completed checkpoints advance; original pending evidence stays in its inbox.
- Actual workerd shutdown/restart with persisted D1: inbox resumes, duplicate inputs create one candidate, missing candidate job is repaired, and original attribution survives.
- Injected SQLite checkpoint failure: source updates and lease release both roll back, then succeed after recovery.
- Injected candidate write failure: failed-source evidence persists independently; healthy source checkpoints advance, then the failed evidence is retried successfully without needing another upstream fetch.
- Eight simultaneous 250 KB source items: separate durable inbox rows retain all 2 MB of original content; manifest stays small and query budget holds.
- Concurrent stale candidate processors: only one canonical article/evidence graph commits.
- Encrypted full synthetic restore and tamper rejection, all exported rows/FTS rowids, original IDs/relationships, and foreign keys.

**Tests passed: 1,223 unique automated tests (1,074 application + 149 Worker). Tests failed: 0. Existing skips: 2.** The final URL-normalization/stable-external-ID review fix was subsequently verified by 11 focused polling/editorial/storage tests; these overlap the full suite and are not added to the unique count. Separate validation passed 48 browser routes, 16 recorded auth HTTP samples, 120 registry HTTP continuations, encrypted restore/tamper checks, and all 45 additive migrations with no pending second application or FK violations. Logs are under `reports/batched-polling-capacity/validation/` and `regression/staging-readiness/`; browser/auth/migration evidence is alongside them. No tests were removed. An obsolete assertion expecting eight enabled production cron ticks was changed to verify the new bounded runner and disabled POC cron. An initial `.js`/ES-module export mismatch was fixed by using `.mjs` with a declaration file; the subsequent suite passes.

Browser validation: 48 existing routes passed against local no-R2 workerd, KC and SEA, desktop and responsive mobile-web Chromium. Authentication validates registration, native-compatible existing hashes, login/logout, concurrent/expired sessions, reset/single-use behavior, restart, and offline restoration. No native Android/iOS device validation was performed; no UI/native code changed.

## Remaining blockers and next action

1. Hosted CPU for RSS parsing, JSON inbox serialization, canonical preparation, password hashing, and scheduler chains remains unmeasured. Local workerd success does not prove compliance with the 10 ms hosted Free allowance. No approval to deploy was given.
2. The 50-DAU target passes for this precise workload. Live provider redirects/errors, large bursts/corrections, observer-disabled notification fanout, separate video ingestion, and mature historical sports research need their own measured demand envelopes. Source inputs exceeding supported D1 inbox limits remain explicit errors with unadvanced checkpoints, not truncated successful ingestion.
3. Minute-by-minute dispatch and cold-start/recovery backlog must be measured end to end before enabling any cron. Source intervals are unchanged, but the accelerated virtual replay is not a demonstration of one real scheduler worker keeping up with a cold burst in wall time.
4. Source registry preparation and verified video-source preparation must precede ingestion on a fresh database. The bounded RSS registry path is verified locally; no remote preparation occurred. Use the bounded HTTP runner, not a legacy Node scheduling call that merely returns a batch token.
5. Annual retained-reference storage, long-term automation ledger/candidate job growth, offline backup retention, real account consumption, and other-product/background traffic remain unqualified. Do not implement multi-D1 routing based only on this daily-write result.
6. The new D1 candidate continuation records generation usage, while Three & Out generation/delivery uses its existing separate automation path. Schedule and verify that path independently; a successful poll is not a briefing-delivery certificate.

**Recommended next action:** review this isolated commit and workload evidence, then qualify capped scheduler catch-up, live-provider bursts, and hosted CPU in an explicitly approved isolated environment. Keep crons disabled until that review. No paid infrastructure is required by this implementation.

## Rollback and reproduction

Pause all pollers before rollback. Drain or securely export the pending batch/inboxes and candidate jobs; verify no pending source inbox remains before reverting to the legacy protocol. Never drop the new tables or discard their original feed items. If the new code cannot drain, restore the verified offline backup and explicitly replay pending inbox evidence before enabling legacy source polling. Keep migration 0045 applied: it is additive and the old code does not need to delete it. Existing source checkpoints and all previous jobs/IDs remain available; PostgreSQL rollback files were preserved.

Local reproduction, with dependencies already installed and DATABASE_URL absent:

```sh
DD_BATCHED_POLLING=true DD_DAY_REPORT_DIR=reports/batched-polling-capacity/qualified TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/replay-content-day.ts
DD_BATCHED_POLLING=true DD_REGISTRY_PREFLIGHT=true DD_DAY_REPORT_DIR=reports/batched-polling-capacity/setup TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx scripts/replay-content-day.ts
python3 scripts/project-batched-polling-capacity.py
python3 scripts/qualify-staging.py
node scripts/qualify-staging-workers.mjs
```

The complete-day baseline stays at the previously committed evidence. The new report directory contains final ledgers and local validation artifacts. No Front Office or Parlay Lab product implementation was changed; their existing regressions were rerun.
