# Source Watcher + Story Engine

This is the persistent ingestion foundation for Down & Distance. It is a modular monolith: the scheduler, fetcher, candidate processor, story engine, and admin API live in the Next.js repository while PostgreSQL provides the source registry, durable queue, idempotency, evidence graph, version history, and event outbox.

## Flow

```text
content_sources -> scheduler -> ingestion_jobs (SOURCE_FETCH)
  -> allowlisted RSS/Atom fetch -> content_candidates
  -> ingestion_jobs (CANDIDATE_PROCESS) -> team/entity/type matching
  -> new canonical_story OR attach story_evidence
  -> material change? -> story_versions + story_domain_events
```

The scheduler only enqueues work. Workers claim rows with `FOR UPDATE SKIP LOCKED`, so multiple processes can operate safely. Unique idempotency keys prevent duplicate scheduled jobs. Source/external-ID and source/canonical-URL constraints prevent repeat ingestion while allowing separate sources to corroborate the same story.

Every generated claim has one or more candidate evidence IDs. Evidence is retained even when it is corroboration rather than a material update. Ambiguous matches and uncertain/rumor-like summaries enter review instead of auto-publishing. Auto-publishing is limited to high-confidence factual event types from official sources.

## Setup and commands

Apply all migrations:

```bash
npm run auth:migrate
```

Exercise the logic without network or database access:

```bash
npm run source:demo
npm run test:story-engine
```

Schedule due sources and drain queued work:

```bash
npm run source:watch -- run
```

Production should invoke `source:watch -- schedule` from a cron/managed scheduler and run one or more long-lived workers using `source:watch -- work` (or wrap `workOne` in the deployment's job runner). Failed jobs use bounded exponential backoff and eventually become `DEAD`; failed sources also back off independently.

## Adding a source

Insert a `content_sources` row with a stable ID, team ID or `league_wide=true`, registered home/feed URLs, source type, reliability, interval, polling tier, and priority. V1 production fetching supports RSS/Atom. HTML and structured API strategies are explicit extension points rather than silent generic scraping. Arbitrary user-supplied URLs are never fetched; the fetcher verifies protocol, host allowlisting, and local/private-address restrictions.

The migration seeds a small KC, Chicago, and league-wide registry to prove that the model is team-agnostic. Adding all 32 teams is data/configuration work, not a schema change.

## Operations

Authenticated admins listed in `ADMIN_USER_IDS` can inspect `GET /api/admin/source-health`. It exposes last check/success, next check, failure count, and the latest error—not raw fetched payloads. Useful alerts include repeated source failures, stale tier-A sources, dead jobs, growth in review-required candidates, and an event outbox backlog.

`story_domain_events` is the stable boundary for future consumers such as The Huddle, Get Caught Up, push notifications, Three and Out, Watch, and mobile clients. Consumers should record their own processing checkpoint and set `processed_at` only if there is a single shared dispatcher.

## Current extension points

- `SourceFetcher`: add policy-reviewed HTML/API/YouTube adapters.
- `StorySynthesizer`: replace deterministic synthesis with a local or hosted model while retaining evidence IDs and publication policy.
- Team/entity aliases: expand nicknames, player/coach rosters, and transaction vocabulary.
- Editorial tools: review ambiguous clusters, merge/split stories, publish/reject drafts, and replay dead jobs.

No page redesign is part of this foundation. Existing product surfaces can migrate to canonical stories incrementally through the event boundary.
