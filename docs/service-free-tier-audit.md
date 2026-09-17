# Scheduled-service free-tier audit — 2026-09-17

## Result

Not yet safe to certify every service stays within its free allowance. The principal
risk is Neon compute: production records confirm approximately 288 ingestion runs
per day (five-minute cadence), in addition to GitHub's ingestion timer. Local
mitigations are prepared, but have not been deployed or applied to provider settings.

## Verified measurements

- GitHub repository `tyler-dingman/nfl_manager` is public. All seven workflows use
  standard `ubuntu-latest` runners. Cache usage: 530,049,279 bytes across two caches.
- SportsGameOdds `/account/usage` reports `amateur`, 101 / 2,500 monthly objects,
  and 10 requests/minute. This is a point-in-time measurement, not a forecast.
- The database selected by `PRODUCTION_DATABASE_URL` is Neon. PostgreSQL reports
  151,838,720 bytes (~152 MB / 145 MiB) for this database. This is not the complete
  Neon project storage meter, which can include other branches/databases/history.
- Largest relations, including indexes: bet_markets 79.9 MB, sportsbook_prices
  18.4 MB, ingestion_jobs 12.4 MB, historical_player_games 8.3 MB, content_candidates
  6.3 MB. No scheduled retention job was found for ingestion history.
- Production content ledger: Sep 11–16 had 288, 289, 288, 287, 287, 289 runs/day.
  Recent entries recur every five minutes, matching the Cloudflare Worker config.
  Ledger records do not positively identify their caller; attribution to the
  Worker is an inference from cadence/configuration, not a Cloudflare log check.

## Workflow inventory (live configuration inspected through GitHub API)

| Job | Configured frequency | Services reached | Assessment |
| --- | --- | --- | --- |
| Content ingestion | Every 15 minutes, two matrix jobs | Vercel, Neon, RSS publishers, YouTube | Duplicates the apparent five-minute Worker; up to 5,760 POSTs/30 days from GitHub alone |
| Cloudflare content Worker | Every five minutes | Vercel and same ingestion dependencies | 8,640 POSTs/30 days; database sleep risk |
| Three & Out | 24 delivery + 2 generation triggers/day | Vercel, Neon, Expo push | 780 scheduled runs/30 days, excluding retries; one generation trigger normally skips for DST |
| Draft prospect sync | Daily | GitHub, public reference sources | 30 runs/month; dependency installation and data commits |
| Search reconciliation | Daily | Neon, configured embedding endpoint | 30 runs/month; recent runs fail; investigate separately before relying on search freshness |
| NFL data sync | Daily in file, disabled_inactivity on GitHub | Public NFL data sources, GitHub | Currently not running automatically |
| Standard/video trial workflows | Manual only | Vercel, Neon, RSS/YouTube | No recurring schedule; fixed trial-window guard |
| Odds imports | Manual CLI only | SportsGameOdds, selected database | No scheduled odds importer found; Parlay Lab reads stored odds |
| Historical stats imports | Manual CLI only | Public data downloads, selected database | Storage and transfer may grow substantially with additional seasons |

Counts assume cron fires as configured. Actual GitHub execution is delayed/dropped
at times; do not depend on missed runs for a quota budget. With both existing
content schedules plus briefing jobs, the baseline is about 15,180 automation POSTs
per 30 days, excluding retries, manual runs, page traffic and preflights.

## Service limits and risk

**Neon:** Free allocation is advertised as 100 CU-hours/project/month, 0.5 GB storage
and 5 GB public network transfer. Minimum 0.25 CU running continuously uses
0.25 × 24 × 30 = **180 CU-hours/month**. Five-minute work can prevent the normal
five-minute idle suspension. Larger compute sizes increase usage. At 0.25 CU, a
single 30-minute scheduler with five idle minutes and one active minute per batch
would use approximately **36 CU-hours/30 days**, before briefing jobs, search,
manual imports, connections, other branches, or user traffic. This is an estimate,
not a cap or actual measured compute. Storage is currently below the published
limit for this one database; ongoing odds/history growth has no guaranteed bound.
Sources: [Neon free-plan guidance](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan),
[compute suspension](https://neon.com/docs/manage/endpoints/).

**SportsGameOdds:** Current account is below quota (~4%). Existing local safety
ceiling is 1,000 monthly objects and two data requests per client instance. Each
import checks provider usage; unavailable usage fails closed. Local changes now
reserve the maximum next response size plus one object of lookup headroom and
respect a lower provider quota. Concurrent processes/other consumers can still
race this check; keep imports serialized. Usage lookups also count toward request
rate, so repeated manual imports can hit 10 requests/minute. No automatic polling
should be added on Amateur without an explicit object budget.
Source: [provider rate limits](https://sportsgameodds.com/docs/info/rate-limiting).

**GitHub:** Standard runners are free for public repositories. Current cache use
is ~0.53 GB against the included 10 GB/repository. No artifact-upload action or
larger/macOS runner found. If made private, content ingestion alone would consume
at least 5,760 rounded job-minutes/month at its existing timer, above the 2,000
GitHub Free allowance. Billing API was inaccessible with the CLI's current scopes;
account-wide costs and budgets were not verified.
Sources: [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[minute rounding](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time).

**Vercel:** Hobby includes 1M function invocations, 4 active CPU-hours and 360 GB-hours
provisioned memory (Fluid Compute); legacy duration accounting differs. Timer
request count alone is comfortably below 1M, but CPU, memory, transfer, builds,
image optimization, and user traffic need actual dashboard measurements. At 15,180
POSTs, just 0.95 active CPU-seconds each would use four hours, before page traffic.
Hobby is for personal non-commercial use; a commercial deployment needs an eligible
plan regardless of usage. Actual plan and Fluid Compute status were not verified.
Source: [Hobby allowances](https://vercel.com/docs/plans/hobby).

**Cloudflare:** The scheduler's 288 triggers/day are far below the Workers Free
100,000 requests/day allowance. CPU limits and other account Workers still matter.
Its downstream Neon workload is the issue, not its own request count. Live trigger
settings and account-wide usage were not accessible.
Sources: [limits](https://developers.cloudflare.com/workers/platform/limits/),
[pricing](https://developers.cloudflare.com/workers/platform/pricing/).

**YouTube:** Ingestion uses uploads playlists rather than repeated searches;
Film Room metadata has a one-hour cache. Google advertises 10,000 daily units for
non-search/upload endpoints. Shared project usage, manual source resolution,
failures/retries and cache churn are not centrally budgeted here, so quota safety
is not guaranteed. The application's generated-story cap is not an API quota cap.
Source: [Google quota overview](https://developers.google.com/youtube/v3/getting-started).

**AI / embeddings:** Content automation explicitly uses deterministic synthesis,
so its stated zero AI spend is consistent with its code path. Other manual content
commands can select OpenAI; they are not covered by a free AI guarantee. Search
indexing previously contacted its configured embedding provider even when the
feature flag was disabled; the local fix now requires explicit enablement and the
scheduled workflow sets it false. Local embedding/Ollama services have no external
API fee, but an operator-configured remote endpoint may.

**Expo:** Briefing push delivery uses Expo, which has no push-service fee and a
600 notifications/second/project limit. EAS build/update subscriptions are separate
and no scheduled EAS build was found. Stripe commerce transaction fees are separate
from these jobs, not a free scheduled service.
Source: [Expo push FAQ](https://docs.expo.dev/push-notifications/faq/).

## Prepared locally

- Change Cloudflare ingestion from five to 30 minutes.
- Make GitHub content ingestion a manual backup, eliminating the second timer.
- Set ten-minute maximum runtime on all workflows (not an account spending cap).
- Strengthen the odds page-budget check, including lower provider allowances.
- Disable scheduled embedding requests and honor the existing enablement flag.

Tests: 17 provider, content-automation, and search tests passed. No production
schedules, quotas, billing settings, or database data were changed during this audit.

## Required rollout and outstanding checks

1. Deploy the Worker cron change and verify its next runs. Then apply the GitHub
   workflow changes. Keep one scheduler active throughout rollout. If thirty-minute
   freshness is unacceptable, choose another explicit latency/cost tradeoff first.
2. In Neon, verify plan, project/month CU-hours, compute sizing, all branches,
   five-minute scale-to-zero, storage and transfer. Aim below 80 CU-hours, 0.4 GB
   and 4 GB transfer to preserve headroom. These are suggested alert thresholds,
   not provider-enforced guards implemented by this change.
3. In Vercel/Cloudflare, confirm actual plans and current account-wide usage. If
   paid plans are enabled, check hard spending controls; notification-only budgets
   do not prevent bills. Do not upgrade automatically.
4. Set an agreed retention policy for completed/failed ingestion history and odds
   snapshots before purging anything. This audit deleted no data.
5. Confirm YouTube project quota/usage and any schedulers outside this repository.

Access limitations: desktop automation permission was unavailable, no dedicated
Neon/Cloudflare/Vercel management connector was available, GitHub billing API lacked
scope, and local crontab access was denied. Therefore current provider billing
meters, exact paid/free plan status (except SportsGameOdds), and off-repository
schedulers remain unverified. Free-plan limits can pause services rather than bill;
absence of a charge is not evidence that jobs will continue working.

## Follow-up: user-approved daytime schedule

The user requested every two hours from 6 a.m. CST through 8 p.m. CST. The Worker
configuration now uses `0 0,2,12,14,16,18,20,22 * * *` in UTC: eight calls per day
(240 per 30 days), versus the previously observed 288/day. CST is fixed UTC-6;
it does not follow Chicago daylight saving time. At 0.25 CU and six active-plus-idle
minutes per batch, the ingestion-only estimate becomes 6 CU-hours per 30 days.
This excludes site traffic, briefings, search, manual imports and other branches,
and is not a spending guarantee. Deploy the Worker to apply this schedule.

Live rollout completed on 2026-09-17: the existing authenticated Wrangler session
successfully ran `wrangler triggers deploy` for `dnd-content-scheduler` and reported
`0 0,2,12,14,16,18,20,22 * * *` as the deployed schedule. This replaces the prior
trigger without deploying application code. Six content-automation tests passed,
including an assertion mapping every UTC trigger to the eight requested CST hours.
Provider-wide compute/transfer totals still need dashboard verification. The
schedule and documentation edits remain local until committed and pushed.
