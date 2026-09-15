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

- `.github/workflows/content-ingestion.yml` calls `POST /api/automation/content/global` every 15 minutes for standard and video groups.
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
