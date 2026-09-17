# Daily NFL content pipeline

This document describes the production path after the content freshness audit.

## Runtime flow

```text
Team source definitions
  src/data/sources/monitoring/*
        ↓ registry synchronization
content_sources
        ↓ due-source scheduling
ingestion_jobs (SOURCE_FETCH)
        ↓ RSS fetch + normalization
content_candidates
        ↓ team association + CANDIDATE_PROCESS
story clustering / material-change evaluation
        ↓
canonical_stories + story_evidence + story_versions
        ↓
The Beat (chronological canonical clusters)
Homepage/Huddle (importance + freshness + diversity)
Three & Out (daily, high-significance top three)
```

## Sources and ingestion

- Canonical teams: `src/server/ingest/teams.ts`, exposed through `src/data/teams.ts`.
- Coverage assertion: `assertNFLTeamCoverage()` in `src/data/sources/monitoring/index.ts`.
- Per-team source definitions: `src/data/sources/monitoring/team-baselines.ts`; KC has additional definitions in `kc.ts`.
- Registry synchronization: `src/server/monitoring/observer.ts` writes `content_sources`.
- Scheduler and worker: `src/server/story-engine/service.ts`.
- Durable jobs and source health: `src/server/story-engine/repository.ts` and `ingestion_jobs`.
- Normalization/team association: `src/features/story-engine/normalization.ts`.
- Clustering: `src/features/story-engine/clustering.ts`.
- Publishing rules and rejection reason: `publishing-policy.ts` and `content_candidates.rejection_reason`.

YouTube sources are ingested into Film Room but intentionally excluded from The Beat. Credentialed X sources remain disabled unless their official adapter environment variables are configured. No paid AI is required; scheduled runs use `GroundedDeterministicStorySynthesizer`.

## Surface behavior

- The Beat: `listPublicStoryPage()` in `src/server/story-engine/projections.ts`. It reads published canonical clusters and sorts by meaningful publication/update time, ingestion tie-breaker, then stable ID. Route: `GET /api/content/huddle` (`force-dynamic`).
- Homepage/Huddle: `canonicalHuddle()` in `src/server/content/canonical-surfaces.ts`, using `teamStoryImportanceService` plus diversity. Route: `GET /api/content/homepage` (`force-dynamic`).
- Three & Out: `src/server/three-and-out/daily-service.ts`, stored once per team/date in `three_and_out_snapshots`. Route: `GET /api/three-and-out` (`force-dynamic`). Delivery preferences and email/SMS/push delivery remain separate.

These routes do not use ISR. Client fetches use `cache: no-store` where appropriate, and server routes are dynamic, so newly published database content is visible without a redeploy.

## Production scheduling

- `workers/content-scheduler` owns scheduled ingestion every two hours from 6 a.m. through 8 p.m. fixed CST (UTC-6), eight runs daily. `.github/workflows/content-ingestion.yml` is a manual backup for standard and video groups; deploy the Worker schedule change before disabling the existing GitHub timer.
- `.github/workflows/three-and-out-daily.yml` generates the daily edition around 4:40 PM Central and checks due deliveries through the US evening.
- Both endpoints require `Authorization: Bearer $CONTENT_AUTOMATION_SECRET`.
- GitHub must define `CONTENT_AUTOMATION_BASE_URL` and `CONTENT_AUTOMATION_SECRET`; the deployed application must contain the same secret.
- `content_automation_runs` records global run summaries. `content_sources`, `ingestion_jobs`, candidate statuses, and rejection reasons provide per-source/job diagnostics.

GitHub workflow files do not prove that repository secrets are configured or that recent workflow runs succeeded. Check the Actions run history after deployment.

## Operations

```bash
npm run content:audit
npm run content:refresh -- --dry-run
npm run content:refresh
npm run content:refresh -- --team=KC
npm run content:refresh -- --team=KC,DEN --reason=GAME_FINAL --force-three-out
npm run content:three-out
npm run content:three-out -- --team=KC
```

Refresh is idempotent through source/external-ID constraints, stable job keys, canonical clustering, and daily team/date snapshot uniqueness. Team failures are isolated and reported without aborting remaining teams.

## Health interpretation

`content:audit` separates source-pipeline health from story activity:

- `HEALTHY`: source checks are current.
- `STALE`: sources have not been attempted in 12 hours.
- `FAILED`: repeated source failures and no recent successful fetch.
- `MISCONFIGURED`: no team-specific source definition.
- `FRESH`, `QUIET`, and `NO_CONTENT` describe published-story recency separately, so a quiet news day alone does not mark ingestion as broken.

### Authentication checks and credential rotation

The ingestion workflow performs an authenticated, read-only GET on
`/api/automation/content/global` before POSTing. Deploy the updated API before
merging/enabling the updated workflow. Use the workflow's `check_only` input to
verify the deployment and GitHub credential without ingesting. The check confirms
authentication, not database/source health. Both methods use the same verifier.

Use the canonical production origin (`https://www.downdistance.com`) for
`CONTENT_AUTOMATION_BASE_URL`. Redirects are rejected without forwarding the token.
401/403 responses distinguish API credential rejection from likely deployment
protection; a missing/malformed server credential returns 503. Authentication
failures are not retried, and POSTs are not automatically retried because a timed-out
request may already have executed. Response bodies and credentials are not logged.

For rotation without interrupting content schedulers:
1. Set the deployed `CONTENT_AUTOMATION_PREVIOUS_SECRET` to the old token and
   `CONTENT_AUTOMATION_SECRET` to the new token, then deploy.
2. Update GitHub's `CONTENT_AUTOMATION_SECRET` and the Cloudflare content worker's
   `DND_AUTOMATION_SECRET` to the new token. Update any other callers of the content
   endpoints. Three & Out uses the primary secret only, so coordinate its callers too.
3. Run ingestion with `check_only: true`, then verify both ingestion groups.
4. Remove `CONTENT_AUTOMATION_PREVIOUS_SECRET` and redeploy after all content
   callers have migrated. Keep overlap short; both tokens grant access during it.

A previous token cannot enable access when the primary token is absent or malformed.
No workflow can guarantee credentials will never drift; run the check after every
production deployment or secret update, before relying on the next scheduled run.
