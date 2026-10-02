# Neon environment and scheduler audit — September 27, 2026

## Scope and confidence

Read-only inspection of the authenticated Vercel team, Cloudflare account, GitHub repository `tyler-dingman/nfl_manager`, local configuration/processes, and repository history. No deployments, environment changes, scheduler changes, database queries/dumps, or production data modifications were performed in this audit. Credentials were processed only in memory where needed; this report contains destination identities and variable names, never connection strings or secret values.

Live configuration and retained deployment metadata were checked, not merely checked-in configuration. GitHub run history covers September 4–27. Inventory is limited to the accessible linked accounts/repository and this computer: other accounts, other developers' computers, external cron services and deleted deployments cannot be ruled out. This is an access/frequency audit, not measured byte attribution.

## Principal findings

1. **Vercel's current database binding is shared by Production and Preview.** There is no branch restriction. This exposes production to future preview deployments. However, the 18 retained previews are from March and have **no database environment binding**; they are not demonstrated production database consumers.
2. **Cloudflare is the current scheduled ingestion owner:** one worker, eight triggers daily, calling the production website. No Vercel cron definitions, additional Cloudflare workers, Pages projects, Workflows or Queues were found in the audited account.
3. **GitHub runs Three & Out and reference-data schedules. Search reconciliation is scheduled but broken.** All 23 search runs in the window failed; the latest eight explicitly report a missing database URL. Earlier sampled failures also show an empty database variable. Treating this nightly job as an established large egress source is unsupported.
4. **Local development is configured for local PostgreSQL**, including the local frontend used by Codex. A separate production URL is nevertheless available to explicitly production-targeted local scripts. A bulk production-to-local sync can produce substantial egress independent of visitors.
5. **No duplicate active ingestion scheduler is confirmed today.** Historical configuration is more concerning: Cloudflare was configured every five minutes and GitHub ingestion every 15 minutes before September 17. Actual historical Cloudflare execution counts are needed to establish the overlap and its volume.
6. **Three & Out generation has two entry points:** ingestion force-regenerates briefings for changed teams; the delivery worker generates missing briefings. This is overlapping generation work, not evidence of duplicate deliveries.

## Safe destination comparison

| Identity | Observed value / relationship |
|---|---|
| Vercel project | `nfl-manager`, `prj_jA9CfYuRrE9UKuXVvCivNxuQlrZp` |
| Vercel Neon integration resource | `neon-celeste-bell`, external resource ID `raspy-cloud-19725957`, store `store_pY4tGHKqPhqSsSmx` |
| Vercel database variable | One sensitive `DATABASE_URL` binding targets both `production` and `preview`; Neon companion variables share those targets. No Development-scoped database binding was returned. |
| Local production destination | Normalized endpoint `ep-dawn-night-awmco80m.c-12.us-east-1.aws.neon.tech`, database `neondb` (`-pooler` removed solely for comparison). |
| Local default destination | `localhost`, database `down_distance` |
| Cloudflare destination | `https://www.downdistance.com`; no direct database binding |
| GitHub trial workflow variable | `CONTENT_AUTOMATION_BASE_URL` points to `https://www.downdistance.com` |
| GitHub delivery/manual ingestion secret | Same variable name, but stored as an unreadable GitHub secret. Its actual destination cannot be compared directly through the API. Latest delivery failure reports quota exceeded/HTTP 500, consistent with the production incident, but not a host-identity proof. |

Vercel returned sensitive variable metadata, not usable plaintext values, even through the individual-variable endpoint. The shared **integration binding** between Production and Preview is confirmed; the exact Vercel endpoint/branch-to-local-production-host equality remains unverified. Integration resource identity alone does not prove the branch/endpoint. No diagnostic endpoint was deployed to reveal it.

## Environment/workload inventory and egress risk

Risk describes potential volume and repetition, not a measured share of 6.46 GB.

| Environment/workload | Production access determination | Egress risk |
|---|---|---|
| Current Vercel Production | Confirmed production website has the Neon integration binding. All request-driven database features execute here. | **High aggregate:** ingestion plus API/page reads, browser polling and retries. |
| Future Vercel Preview | Current project config supplies the same database binding to Preview and Production without branch restriction. | **High isolation risk:** testing/crawling a new preview can query production. Not evidence of historical preview consumption. |
| 18 existing previews | Deployment snapshots contain no database variable names; all date to March 17–18. | **Low demonstrated direct risk.** No production DB binding found. Indirect calls from old code are not exhaustively excluded. |
| Retained production deployments | 20 retained production records: 19 READY, one ERROR. Database variable names present in each. Current deployment plus 18 older READY deployments could serve requests at retained URLs. | **Medium conditional:** old code may lack read reductions. Retention is not continuous execution; no cron definitions found in any of the 38 snapshots. No request-volume attribution available. |
| Local/Codex Next server | One observed Next server, default file configuration uses local DB; no inherited DB override visible in process inspection. Runtime JS-loaded environment is not independently proven by `ps`. | **Low routine risk**, conditional on local configuration. Codex uses this same workspace/server, not an identified additional hosted database environment. |
| Local production utilities | Separate production credential is present. Sync-to-local, parlay audit/import/sync and explicitly production-targeted migration scripts can use it. | **High per bulk read**, unknown execution frequency. No active production sync process or recurring local job found. |
| Local mobile app | API origin points to a LAN address, not the public production site. | **Low direct risk**; depends on the LAN backend's database. No direct mobile Neon connection identified. |
| Cloudflare ingestion worker | Confirmed indirect access through production Vercel API. Only base URL and automation secret bindings; no database/Hyperdrive binding. | **High likely recurring contributor:** all-team source scheduling, story matching/evidence reads and video synchronization. |
| GitHub Three & Out | Calls API using repository secret origin; probable production target, exact secret-origin equality unavailable. Latest run reached an API returning quota exceeded. | **Medium–high recurring potential:** up to 288 runs/day under new schedule, plus retry attempts. Does not describe its historical daily frequency. |
| GitHub search indexing | Direct DB job requires absent repository `DATABASE_URL`; no environment-scoped fallback configured. | **Currently low/blocked. High potential if enabled unchanged**, because reconciliation reads the corpus. |
| GitHub manual ingestion/trials | Manual-only today. Trials' public repository variable identifies production; main ingestion uses unreadable secret origin. | **Medium conditional**, including concurrent manual and scheduled runs. |
| GitHub NFL/draft reference sync | No database binding in workflows; scripts update repository reference data. | **Low direct Neon risk.** Commits may indirectly trigger deployments and any build-time reads. |
| Other local schedulers | No user crontab or relevant launch-agent job found; Ollama is persistent but is not itself a Neon query scheduler. | No additional database schedule demonstrated. |

Current production deployment: `dpl_9XrZ1osEmqKCxoKvfTLxUmA8Le6M`, created `2026-09-27T23:07:40.824Z`, commit `22aa7d3d948b48d076b757f643f89e5ebcfef992`. Public production aliases point here. Old branch aliases remain attached to preview deployments. Existing September 17 cleanup reports are historical; the live inventory now contains 38 deployment records.

## Current recurring jobs

All cron times below are UTC. GitHub scheduled execution can be delayed; these are configured frequencies, not guaranteed dispatch counts.

| Owner | Job / trigger | Frequency | Database relationship |
|---|---|---|---|
| Cloudflare | `dnd-content-scheduler`: `0 0,2,12,14,16,18,20,22 * * *` | 8/day, at 00:00, 02:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00 | POST `/api/automation/content/global` on production; source due-times and generation budgets gate actual work. |
| GitHub | `.github/workflows/three-and-out-daily.yml`: `*/5 * * * *` | Up to 288/day | POST `/api/automation/three-and-out?action=deliver`; generates missing briefings on demand. `curl --retry 2` permits up to three attempts for retryable failures; concurrency group serializes workflow runs, not all other callers. |
| GitHub | `.github/workflows/search-index.yml`: `30 4 * * *` | 1/day, 04:30 | Direct reconciliation job, currently failing without database configuration. |
| GitHub | `.github/workflows/draft-prospect-sync.yml`: `15 8 * * *` | 1/day, 08:15 | Reference-data sync; no direct Neon binding. |
| GitHub | `.github/workflows/nfl-data-sync.yml`: `0 3 * * *` | 1/day, 03:00 | Reference-data sync; no direct Neon binding. |
| GitHub | Content/video ingestion, standard trial, video trial | **No current schedule**; manual dispatch only | Main ingestion is a manual backup; trial workflows remain active definitions with time-window checks. |
| Vercel | Project and all retained deployments | **No cron definitions** | Request-triggered server functions still access DB. |
| Local | User crontab / relevant launch agents | None found | Explicit manual commands remain possible. |

Request-driven repetition also matters: GameDay room polling every **4 seconds** (900 requests/hour/tab), trivia event polling every **15 seconds** (240/hour/tab), notification count polling every **30 seconds** (120/hour/tab). These are not platform cron jobs, but an open production tab can generate recurring DB work with very few users. The local egress-reduction patch pauses hidden-tab notification polling; its deployment status should be checked rather than assumed. News ticker polling every six seconds reads an in-memory news source, not directly Neon. UI clocks/animations are not database schedules.

## Historical jobs and duplicates

GitHub observed runs in September 4–27:

| Workflow/event | Runs | Success / failure | Interpretation |
|---|---:|---|---|
| Search scheduled | 23 | 0 / 23 | Latest eight explicitly missing DB URL; three older sampled runs have empty DB variable and fail in reconciliation. Not an established successful nightly corpus reader. |
| Three & Out scheduled | 86 | 43 / 43 | Earlier cadence differs from today's five-minute schedule. Latest failure includes quota exceeded. Successful workflow status alone does not imply a delivery to every recipient. |
| Content ingestion scheduled | 12 | 1 / 11 | September 15–17; last scheduled start September 17 15:14:49 UTC. Failure does not guarantee no database work occurred. |
| Content ingestion manual | 1 | 0 / 1 | September 17. |
| Standard trial scheduled | 2 | 2 / 0 | Last September 7. |
| Video trial scheduled | 2 | 1 / 1 | Last September 7. |
| Standard trial push-triggered | 13 | 3 / 10 | September 7 historical automation amplification. |
| Standard / video trial manual | 4 each | 1 / 3 each | September 7. |
| Draft scheduled | 18 | 18 / 0 | Reference updates. |
| NFL scheduled / manual | 8 / 1 | 4 / 4 scheduled; 1 manual success | Reference updates. |

Cloudflare's sole worker was created September 7; current trigger metadata was modified September 17 at 16:04:08 UTC. Repository history records:

- `45510e0` (September 7): Cloudflare cron `*/5 * * * *` — 288 potential invocations/day.
- `8119c7b` (September 15): GitHub ingestion cron `*/15 * * * *` — 96 potential workflow runs/day, with standard/video matrix work.
- `78e6050` (September 17): Cloudflare temporarily configured `*/30 * * * *`.
- `8deb1bc` (September 17): eight daily Cloudflare triggers; GitHub scheduled ingestion removed in the cutover period.

This is strong evidence of a **historical duplicate scheduling risk**, not proof that all configured invocations executed. GitHub history confirms some ingestion runs. Cloudflare's current API inventory does not establish its old invocation totals or precisely when each historical cron became live. Today's last GitHub scheduled start predates the current Cloudflare trigger update. Do not project today's eight runs/day backward across the full billing period.

**Current workload overlap:** `src/app/api/automation/content/global/route.ts` calls `generateDailyThreeAndOut(teamId, { force: true })` for changed teams after ingestion. The separate delivery route generates missing briefings. These are intentional refresh and delivery paths, but both read briefing/story data and their concurrency is not covered by a shared GitHub workflow group. This is not a second daily delivery cron. Keep correctness/claim safeguards when considering consolidation.

No caller of the `indexDocument` full-reconciliation wrapper was found elsewhere in the repository; no second scheduled search indexer was found. Manually running `scripts/search-index.ts` remains possible.

## Recommended isolation while staying on Free — not applied

1. **Scope production database integration variables to Vercel Production only.** Give Preview a separate development Neon project, or disable DB-backed preview functionality until that project is ready. Include all generated database aliases, not only `DATABASE_URL`. Validate scope on a fresh preview; configuration changes do not rewrite existing deployment snapshots.
2. **Keep local/Codex on local PostgreSQL.** Move production credentials out of routine local application environment loading into an explicit operations-only workflow. Use small sanitized fixtures for local/preview data; avoid repeated complete production downloads. Production read-only roles reduce mutation risk but do not limit egress.
3. **Use a separate development project rather than merely another branch of production for quota isolation.** Current Neon documentation lists Free allowances of 100 projects, 10 branches/project, 0.5 GB storage/project, 100 CU-hours/project/month and 5 GB public transfer/project/month. Branches within one project share its transfer allowance. Verify the integration-provisioned project's actual/legacy plan in Neon before applying; the account's billing plan was not verified here. Do not use extra projects to shard production merely to evade a quota.
4. **Keep one documented scheduler owner per task:** Cloudflare ingestion; GitHub Three & Out delivery; one search reconciler when ready; GitHub reference sync. Keep manual backup explicitly manual. Retire obsolete trial workflows after confirming no continuing need. Do not blindly reduce five-minute delivery checks: that would change saved local-time delivery behavior.
5. **Do not fix missing search credentials by immediately turning on an unbounded production scan.** First decide whether the scheduled indexer is needed and implement/validate the incremental corpus strategy from the egress audit; then provision a deliberate least-privilege production job identity and measure its reads.
6. **Review old production URLs and deployment protection.** Retain an intentional rollback set; remove/protect obsolete deployments only after approval. Merely deleting dormant deployments does not guarantee egress savings. Also isolate automation secrets/API destinations from Preview so it cannot invoke production ingestion indirectly.
7. **Measure ingestion first, historical overlap second, and open-tab polling third.** Obtain Cloudflare invocation history and Vercel route traffic for September 4–27, including retries and old deployment URLs. Add distinct PostgreSQL `application_name` values for web, ingestion, delivery, index and explicit operations in a later implementation. This improves attribution without logging secrets; it does not itself measure wire bytes.

References: [Neon current plan documentation](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md), [Vercel environment variable deployment behavior](https://vercel.com/docs/environment-variables).

## Remaining verification boundaries

- Exact Vercel endpoint/branch identity versus local `PRODUCTION_DATABASE_URL`; encrypted settings expose their shared binding, not plaintext destination.
- GitHub secret origin for main ingestion and delivery; public trial origin is confirmed separately.
- Neon-side branch/client metrics, actual account plan, transfer by workload, replication/CDC/subscribers, and other database consumers outside the linked accounts. No Neon management credential/session was available for that inventory.
- Historical Cloudflare invocation outcomes and Vercel request totals, including deleted deployments; present configuration cannot reconstruct them.
- All manual production script executions and other machines; no comprehensive historical local command audit was attempted.

No configuration or database changes were made. The proposed isolation and scheduler changes require a separate implementation step.
