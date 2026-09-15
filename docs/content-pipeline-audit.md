# Content pipeline audit

Audit date: 2026-09-15

## What was working

- A canonical list of all 32 NFL teams already existed.
- Every team had a baseline source profile: official team feed, SB Nation team feed, and FanSided team feed. National reporter definitions also existed but require configured official access.
- PostgreSQL already provided durable source state, job state, candidates, rejection reasons, canonical clusters, evidence, story versions, automation-run summaries, and team/date Three & Out snapshots.
- GitHub Actions workflows already existed for 15-minute ingestion and daily Three & Out generation/delivery.
- Public content routes are dynamic; excessive Next.js/ISR caching was not the primary freshness failure.
- Candidate processing and daily generation already used deterministic, non-paid synthesis.

## What was broken

- The audited database had 32/32 teams configured in code but many source definitions had never been synchronized to `content_sources`.
- No team had a source fetch inside the expected 12-hour window.
- No team had a published story today or a current Three & Out snapshot.
- The pipeline had no single all-team health command, making the systemic scheduling failure difficult to distinguish from a quiet news day.
- Manual recovery required combining registry synchronization, scheduling, job draining, and Three & Out generation by hand.
- FanSided feeds redirect from `www` to the same apex domain, but the SSRF allowlist compared hostnames literally and rejected all 31 redirected feeds.
- `replayRecentStories()` contained Chiefs-specific headline matching in otherwise generic pipeline logic.
- Production scheduling depends on GitHub/application secrets, but code cannot verify whether those secrets or recent Actions runs exist.

## Root causes

1. Scheduled workflow presence was mistaken for proof of successful production execution.
2. Source definitions and database registrations drifted apart.
3. There was no per-team operational report exposing last attempt, last success, latest story, current Beat volume, homepage candidates, and Three & Out readiness.
4. There was no unified targeted/all-team recovery command.
5. Safe same-domain `www` redirects were treated as unrelated hosts.

## What was fixed

- Added `assertNFLTeamCoverage()`; it fails unless exactly all 32 canonical teams have source coverage.
- Added `npm run content:audit` with source health, story freshness, Beat/homepage counts, Three & Out readiness, rejection counts, and explicit warnings for every team.
- Added `refreshNFLContent()` and `npm run content:refresh`, including all-team, targeted-team, game-final reason, dry-run, idempotency, and per-team failure isolation.
- Added `npm run content:three-out` for explicit all-team or targeted regeneration.
- Removed the KC-specific relevance check from generic story replay.
- Documented the actual source-to-surface path and production schedule/security requirements.
- Reused existing health/job tables instead of introducing a duplicate ingestion-run system.
- Updated URL safety to treat only `www.example.com` and `example.com` as the same registered host; unrelated redirect hosts remain blocked.

## Remaining limitations

- GitHub repository secrets and recent Actions success cannot be proven from the local checkout. Production must configure `CONTENT_AUTOMATION_BASE_URL` and matching `CONTENT_AUTOMATION_SECRET` and verify scheduled workflow history.
- Baseline publisher feed URLs still depend on publishers retaining those public RSS endpoints. The audit reports failures, but it does not fabricate replacement sources.
- Structured game-result and notable-performance story generation is not yet connected to a live postgame event trigger. Existing ingested game coverage can classify/rank correctly, and targeted `--reason=GAME_FINAL` refreshes both teams, but a schedule/result watcher must invoke it automatically.
- A Three & Out edition is intentionally not created when fewer than three legitimate published clusters exist. Fake seed news is not used by the public API.

## Initial measured health

The first audit against the configured database reported:

- 32 teams configured and processable
- 115 team-specific source definitions in code
- 70 enabled/registered source rows
- 0 teams with a source check inside 12 hours
- 0 published stories today
- 0 current Three & Out editions
- 32 stale source pipelines

This confirms the visible freshness issue originated before surface ranking: ingestion/scheduling was not successfully feeding current content into the database.

## Health after recovery refresh

After synchronizing the registries, running the all-team refresh, and fixing safe FanSided redirects:

- 32/32 teams reported `HEALTHY`
- 0 stale, failed, or misconfigured team pipelines
- 234 published Beat stories for the current day
- 32 teams with fresh homepage candidates
- 31 current Three & Out editions
- Jacksonville had two legitimate distinct candidates, so generation correctly declined to fabricate a third

The database used for this audit is the database configured by the local environment. Production will only receive the same recovery after this code is deployed and the GitHub Actions/application automation secrets point at the production deployment and database.
